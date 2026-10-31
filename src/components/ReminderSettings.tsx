import { useEffect, useState } from 'react'
import { reminderBridge as bridge, readReminderStatus as readStatus } from '@/lib/reminders'

export function ReminderSettings() {
  const [status, setStatus] = useState(readStatus)
  useEffect(() => {
    const refresh = () => setStatus(readStatus())
    window.addEventListener('memory-reminder-change', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('memory-reminder-change', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  if (!status) return null
  const time = `${String(status.hour).padStart(2, '0')}:${String(status.minute).padStart(2, '0')}`
  return <details className="reminder-settings">
    <summary>每日复习通知</summary>
    <>
      <div className="reminder-controls"><label className="reminder-toggle"><input type="checkbox" aria-label="开启每日复习通知" checked={status.enabled} onChange={event => bridge()?.configure(event.target.checked, status.hour, status.minute)} />开启提醒</label><label>提醒时间<input type="time" aria-label="每日提醒时间" value={time} onChange={event => {
        if (!/^\d{2}:\d{2}$/.test(event.target.value)) return
        const [hour, minute] = event.target.value.split(':').map(Number)
        bridge()?.configure(status.enabled, hour, minute)
      }} /></label></div>
      <p className="reminder-status" role="status">{status.enabled ? status.permitted ? `每天约 ${time}，有到期卡片时提醒` : '已设定提醒，但系统通知权限未开启' : '每日通知已关闭'}</p>
      <div className="reminder-buttons"><button className="paper-button" onClick={() => bridge()?.testNotification()}>发送测试通知</button><button className="paper-button" onClick={() => bridge()?.openSettings()}>系统通知设置</button></div>
      {status.testMessage && <p className="reminder-status" role="status">{status.testMessage}</p>}
      {status.error && <p className="inline-warning" role="alert">{status.error}</p>}
      <p className="reminder-note">省电策略可能延迟提醒。通过卓易通运行时，还需允许卓易通通知和后台运行；请先发送测试通知。</p>
    </>
  </details>
}
