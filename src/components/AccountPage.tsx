import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'wouter'
import { authenticate, CLOUD_URL, getSession, setSession, signOut, type CloudSession } from '@/lib/cloud-session'
import { getSyncStatus, importGuestLibrary, synchronize } from '@/lib/cloud-sync'
import { loadGuestLibrary, type Library } from '@/lib/study-library'
import { loadGuestMap } from '@/lib/subject-mindmap'
import { readCloudState } from '@/lib/cloud-store'

export function SyncIndicator() {
  const [snapshot, setSnapshot] = useState(() => ({ session: getSession(), status: getSyncStatus() }))
  useEffect(() => { const refresh = () => setSnapshot({ session: getSession(), status: getSyncStatus() }); refresh(); window.addEventListener('memory-cloud-change', refresh); return () => window.removeEventListener('memory-cloud-change', refresh) }, [])
  const { session, status } = snapshot
  if (!session || !status) return null
  const label = status.phase === 'idle' ? `已同步 · ${new Date(status.lastSyncedAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : status.phase === 'syncing' || status.phase === 'checking' ? '正在核对云端资料…' : status.phase === 'auth' ? '需要重新登录，本机资料保留' : `${status.message || '暂未完成同步'}${status.pending ? `（${status.pending} 项待上传）` : ''}`
  return <div className={`sync-indicator sync-${status.phase}`} data-sync-phase={status.phase}><Link href="/login">{session.user.email}</Link><span role="status">{label}</span>{status.phase === 'auth' ? <a href="/login?reauth=1">重新登录</a> : <button disabled={status.phase === 'syncing'} onClick={() => { void synchronize() }}>立即同步</button>}</div>
}

export function AccountPage() {
  const session = getSession()
  const [mode, setMode] = useState<'login' | 'register' | 'reset-password'>('login')
  const [email, setEmail] = useState(session?.user.email || '')
  const [password, setPassword] = useState(''), [recoveryCode, setRecoveryCode] = useState('')
  const [created, setCreated] = useState<(CloudSession & { recoveryCode?: string }) | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const reauth = new URLSearchParams(window.location.search).has('reauth')
  if (session && !reauth) return <SignedInAccount session={session} />
  const enter = (value: CloudSession) => { setSession(value); window.location.assign('/') }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try {
      const result = await authenticate(mode, email, password, recoveryCode)
      setPassword(''); setRecoveryCode('')
      if (mode === 'register') setCreated(result); else enter(result)
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="account-page">
    {CLOUD_URL.startsWith('http://') && <p className="account-note">本地同步验证环境，尚未连接正式账号服务。</p>}
    {created ? <><h1>Recovery Key</h1><p>请把恢复码保存在安全的位置。忘记密码时可用它重置密码；目前不提供邮件找回。</p><label>账号恢复码<textarea aria-label="账号恢复码" readOnly value={created.recoveryCode} rows={3} /></label><button className="paper-button primary" onClick={() => enter(created)}>我已保存，进入资料库</button></> : <>
      <h1>{mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Recover Account'}</h1>
      <p>同一账号可在手机、平板和电脑登录，同步卡片、图片、复习记录和导图。</p>
      <form onSubmit={submit}><label>邮箱<input aria-label="账号邮箱" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label><label>{mode === 'reset-password' ? '新密码' : '密码'}<input aria-label="账号密码" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></label>{mode === 'reset-password' && <label>恢复码<input aria-label="恢复码" value={recoveryCode} onChange={event => setRecoveryCode(event.target.value)} required maxLength={100} /></label>}
        {mode !== 'login' && <p className="account-note">密码至少 12 个字符。邮箱用作账号名称，不代表已验证邮箱归属。</p>}
        {error && <p className="inline-warning" role="alert">{error}</p>}
        <button className="paper-button primary" type="submit" disabled={busy}>{busy ? '正在连接…' : mode === 'login' ? '登录' : mode === 'register' ? '注册同步账号' : '重置密码并登录'}</button>
      </form>
      <div className="account-links"><button disabled={busy} onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>{mode === 'register' ? '已有账号，去登录' : '注册账号'}</button><button disabled={busy} onClick={() => { setMode(mode === 'reset-password' ? 'login' : 'reset-password'); setError('') }}>{mode === 'reset-password' ? '返回登录' : '使用恢复码找回密码'}</button></div>
      <Link className="account-offline" href="/">继续离线使用</Link>
    </>}
  </section>
}

function SignedInAccount({ session }: { session: CloudSession }) {
  const [guest, setGuest] = useState<Library | null>(null), [imported, setImported] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([loadGuestLibrary(), readCloudState(session.user.id)]).then(([library, state]) => { if (active) { setGuest(library); setImported(!!state.importedGuest) } }).catch(() => { if (active) setMessage('本机资料读取失败，请保留应用数据后重试。') })
    return () => { active = false }
  }, [session.user.id])
  return <section className="account-page"><h1>Your Account</h1><p>{session.user.email}</p><div className="account-migration"><h2>本机原有资料</h2><p>{guest ? `${guest.subjects.length} 个学科 · ${guest.cards.length} 张卡片` : '正在读取…'}</p><p className="account-note">导入会合并到当前账号，原本机副本保留。不会自动把本机资料交给其他账号。</p><button className="paper-button" disabled={busy || !guest || imported} onClick={async () => {
    if (!guest) return
    setBusy(true); setMessage('')
    try {
      const maps = guest.subjects.flatMap(subject => { const value = loadGuestMap(subject); return value.data.nodeData.children?.length ? [{ subjectId: subject.id, value }] : [] })
      await importGuestLibrary(guest, maps); setImported(true); setMessage('已导入本机账号副本，上传进度见同步状态。')
    } catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }}>{imported ? '本机资料已导入此账号' : '将本机资料导入此账号'}</button></div>{message && <p role="status">{message}</p>}<div className="account-links"><Link className="paper-button primary" href="/">回到今日复习</Link><button disabled={busy} onClick={() => { setBusy(true); void signOut() }}>退出账号，保留本机副本</button></div><p className="account-note">退出不会删除未上传更改。重新登录同一账号后会继续同步。</p></section>
}
