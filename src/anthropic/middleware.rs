//! Anthropic API 中间件

use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use parking_lot::RwLock;

use crate::common::auth;
use crate::kiro::provider::KiroProvider;
use crate::model::config::CompressionConfig;

use super::cache_tracker::CacheTracker;
use super::types::ErrorResponse;

#[derive(Clone)]
pub(crate) struct PromptCacheSnapshot {
    pub accounting_enabled: bool,
    pub ttl_seconds: u64,
    pub tracker: Arc<CacheTracker>,
}

pub struct PromptCacheRuntime {
    accounting_enabled: bool,
    ttl_seconds: u64,
    tracker: Arc<CacheTracker>,
}

impl PromptCacheRuntime {
    pub fn new(ttl_seconds: u64, accounting_enabled: bool) -> Self {
        Self {
            accounting_enabled,
            ttl_seconds,
            tracker: Arc::new(CacheTracker::new(Duration::from_secs(ttl_seconds))),
        }
    }

    pub fn snapshot(&self) -> PromptCacheSnapshot {
        PromptCacheSnapshot {
            accounting_enabled: self.accounting_enabled,
            ttl_seconds: self.ttl_seconds,
            tracker: self.tracker.clone(),
        }
    }

    pub fn update(&mut self, ttl_seconds: Option<u64>, accounting_enabled: Option<bool>) {
        if let Some(value) = accounting_enabled {
            self.accounting_enabled = value;
        }

        if let Some(value) = ttl_seconds
            && self.ttl_seconds != value
        {
            self.ttl_seconds = value;
            self.tracker = Arc::new(CacheTracker::new(Duration::from_secs(value)));
        }
    }
}

/// 应用共享状态
#[derive(Clone)]
pub struct AppState {
    /// API 密钥（使用 RwLock 包裹以支持运行时修改）
    pub api_key: Arc<RwLock<String>>,
    /// Kiro Provider（可选，用于实际 API 调用）
    /// 内部使用 MultiTokenManager，已支持线程安全的多凭据管理
    pub kiro_provider: Option<Arc<KiroProvider>>,
    /// Profile ARN（可选，用于请求）
    pub profile_arn: Option<String>,
    /// 输入压缩配置（共享引用，支持热更新）
    pub compression_config: Arc<RwLock<CompressionConfig>>,
    /// Prompt Cache 运行时配置（共享引用，支持热更新）
    pub prompt_cache_runtime: Arc<RwLock<PromptCacheRuntime>>,
}

impl AppState {
    /// 使用共享的 API Key 句柄创建应用状态
    ///
    /// 用于让 Admin API 能在运行时修改同一个 API Key
    pub fn with_shared_api_key(
        api_key: Arc<RwLock<String>>,
        prompt_cache_runtime: Arc<RwLock<PromptCacheRuntime>>,
    ) -> Self {
        Self {
            api_key,
            kiro_provider: None,
            profile_arn: None,
            compression_config: Arc::new(RwLock::new(CompressionConfig::default())),
            prompt_cache_runtime,
        }
    }

    /// 设置 KiroProvider
    pub fn with_kiro_provider(mut self, provider: Arc<KiroProvider>) -> Self {
        self.kiro_provider = Some(provider);
        self
    }

    /// 设置 Profile ARN
    pub fn with_profile_arn(mut self, arn: impl Into<String>) -> Self {
        self.profile_arn = Some(arn.into());
        self
    }

    /// 设置压缩配置（接受共享引用）
    pub fn with_compression_config(mut self, config: Arc<RwLock<CompressionConfig>>) -> Self {
        self.compression_config = config;
        self
    }

    pub fn prompt_cache_snapshot(&self) -> PromptCacheSnapshot {
        self.prompt_cache_runtime.read().snapshot()
    }
}

/// API Key 认证中间件
pub async fn auth_middleware(
    State(state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let matched = {
        let key = state.api_key.read();
        auth::extract_api_key(&request)
            .map(|k| auth::constant_time_eq(&k, &*key))
            .unwrap_or(false)
    };

    if matched {
        next.run(request).await
    } else {
        let error = ErrorResponse::authentication_error();
        (StatusCode::UNAUTHORIZED, Json(error)).into_response()
    }
}

/// CORS 中间件层
///
/// **安全说明**：当前配置允许所有来源（Any），这是为了支持公开 API 服务。
/// 如果需要更严格的安全控制，请根据实际需求配置具体的允许来源、方法和头信息。
///
/// # 配置说明
/// - `allow_origin(Any)`: 允许任何来源的请求
/// - `allow_methods(Any)`: 允许任何 HTTP 方法
/// - `allow_headers(Any)`: 允许任何请求头
pub fn cors_layer() -> tower_http::cors::CorsLayer {
    use tower_http::cors::{Any, CorsLayer};

    CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
}
