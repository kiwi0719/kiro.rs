import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Copy } from 'lucide-react'
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
import { updateClientKey, generateClientKey } from '@/api/credentials'
import { extractErrorMessage } from '@/lib/utils'

interface ClientKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientKeyDialog({ open, onOpenChange }: ClientKeyDialogProps) {
  const [keyValue, setKeyValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)

  const reset = () => {
    setKeyValue('')
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      // 直接调用后端生成并应用，返回明文 key
      const res = await generateClientKey()
      setKeyValue(res.apiKey)
      toast.success('已生成并应用新的客户端 API Key')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!keyValue) return
    try {
      await navigator.clipboard.writeText(keyValue)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const key = keyValue.trim()
    if (!key) {
      toast.error('请输入或生成一个 API Key')
      return
    }
    setSubmitting(true)
    try {
      await updateClientKey(key)
      toast.success('客户端 API Key 已更新')
      reset()
      onOpenChange(false)
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
          <DialogTitle>修改客户端 API Key</DialogTitle>
          <DialogDescription>
            用于客户端调用 /v1 接口的密钥。修改后立即生效，无需重启服务。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">API Key</label>
            <div className="flex gap-2">
              <Input
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="输入新的 API Key，或点击随机生成"
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!keyValue}
                title="复制"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
              {generating ? '生成中...' : '随机生成（sk-kiro-...）'}
            </Button>
            <p className="text-xs text-muted-foreground">
              注意：点击「随机生成」会立即在服务端应用新 Key，旧 Key 随即失效。
            </p>
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
