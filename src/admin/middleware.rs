//! Admin API 中间件

use std::sync::Arc;

use parking_lot::RwLock;
use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};

use super::service::AdminService;
use super::types::AdminErrorResponse;
use crate::common::auth;

/// Admin API 共享状态
#[derive(Clone)]
pub struct AdminState {
    /// Admin API 密钥（使用 RwLock 包裹以支持运行时修改）
    pub admin_api_key: Arc<RwLock<String>>,
    /// Admin 服务
    pub service: Arc<AdminService>,
}

impl AdminState {
    pub fn new(admin_api_key: Arc<RwLock<String>>, service: AdminService) -> Self {
        Self {
            admin_api_key,
            service: Arc::new(service),
        }
    }
}

/// Admin API 认证中间件
pub async fn admin_auth_middleware(
    State(state): State<AdminState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let matched = {
        let key = state.admin_api_key.read();
        auth::extract_api_key(&request)
            .map(|k| auth::constant_time_eq(&k, &key))
            .unwrap_or(false)
    };

    if matched {
        next.run(request).await
    } else {
        let error = AdminErrorResponse::authentication_error();
        (StatusCode::UNAUTHORIZED, Json(error)).into_response()
    }
}
