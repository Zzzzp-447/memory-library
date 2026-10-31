import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { offlineStatus } from '@/lib/pwa'

export function InstallPage() {
  const [status, setStatus] = useState(offlineStatus)
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  useEffect(() => {
    const refresh = () => setStatus(offlineStatus())
    window.addEventListener('memory-offline-status', refresh)
    return () => window.removeEventListener('memory-offline-status', refresh)
  }, [])
  return <section className="account-page install-page"><img className="install-icon" src="/icon.png" alt="Memory Library 红色文件夹图标" /><h1>On Your Home Screen</h1>
    {standalone ? <p>已从主屏幕打开。</p> : <ol><li>在 iPhone 或 iPad 的 Safari 中打开本页面。</li><li>点击分享按钮，选择“添加到主屏幕”；若出现“作为网页 App 打开”，请开启。</li><li>点击“添加”，然后从主屏幕的红色图标打开。</li></ol>}
    <p role="status" data-offline-status={status}>{status === 'ready' ? '离线资源已准备好。' : status === 'preparing' ? '正在准备离线资源，请保持联网，完成后再断网。' : status === 'error' ? '离线资源准备失败，请保持联网并重新打开本页。' : '当前环境暂不支持离线安装，请使用更新后的 Safari。'}</p>
    <p>从主屏幕打开后，请登录同一账号并等待同步完成，再离线复习。离线制作和复习的数据会保存在本机，恢复网络后继续同步。</p>
    <p className="account-note">首次登录、教材在线搜索和云端同步需要联网。当前 iOS 网页版暂无锁屏或后台通知；每天打开后可查看今日待复习卡片。iOS 不支持网页触发震动，勾叉仍可正常作答。</p>
    <Link className="paper-button primary" href="/">开始使用</Link>
  </section>
}
