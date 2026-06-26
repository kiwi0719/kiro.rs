import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { storage } from '@/lib/storage'
import { updateAdminKey } from '@/api/credentials'
import { extractErrorMessage } from '@/lib/utils'

interface AdminKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 修改成功后回调（用于触发重新登录） */
  onChanged: (newKey: string) => void
}

export function AdminKeyDialog({ open, onOpenChange, onChanged }: AdminKeyDialogProps) {
  const [newKey, setNewKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setNewKey('')
    setConfirmKey('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = newKey.trim()
    if (!key) {
      toast.error('请输入新的管理员密码')
      return
    }
    if (key !== confirmKey.trim()) {
      toast.error('两次输入的密码不一致')
      return
    }
    setSubmitting(true)
    try {
      await updateAdminKey(key)
      // 当前会话用的还是旧 key，更新 storage 以便后续请求使用新 key
      storage.setApiKey(key)
      toast.success('管理员密码已更新')
      reset()
      onOpenChange(false)
      onChanged(key)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改管理员密码</DialogTitle>
          <DialogDescription>
            修改后立即生效，无需重启服务。当前登录会话会自动使用新密码。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">新密码</label>
            <Input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="输入新的 Admin API Key"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">确认新密码</label>
            <Input
              type="password"
              value={confirmKey}
              onChange={(e) => setConfirmKey(e.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
