import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getCatalog, type CatalogProduct, type CatalogSlot } from '@/lib/products.functions'
import { startMpesaPayment } from '@/lib/orders.functions'
import {
  ArrowRight, BadgeCheck, Bell, Bike,  CalendarClock, Check, ChevronRight, CircleUserRound,
  Clock3, Droplets, Home, LogIn, LogOut, MapPin, Menu, Minus, Package, Phone, Plus, RefreshCw,
  ShieldCheck, ShoppingBag, Smartphone, Sparkles, Truck, UserRound, WalletCards, X, Zap
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: Index })

type Profile = { id: string; full_name: string; phone: string; block: string; house_number: string; gate_instructions: string; wallet_balance: number; bottles_with_customer: number }
type Order = { id: string; user_id: string; order_number: string; status: string; payment_method: string; delivery_date: string; delivery_fee_kes: number; total_kes: number; block: string; house_number: string; gate_instructions: string; rider_id: string | null; empties_collected: number; cash_collected: number | null; created_at: string; delivered_at: string | null; delivery_slot_id: string | null }
type Rider = { id: string; full_name: string; phone: string }

const statusMeta: Record<string, { label: string; icon: typeof Check }> = {
  pending_payment: { label: 'Awaiting payment', icon: WalletCards }, confirmed: { label: 'Confirmed', icon: BadgeCheck }, packed: { label: 'Packed', icon: Package }, out_for_delivery: { label: 'Out for delivery', icon: Truck }, delivered: { label: 'Delivered', icon: Check }, cancelled: { label: 'Cancelled', icon: X },
}

function money(value: number) { return `KSh ${Math.round(value).toLocaleString('en-KE')}` }
function normalizeKenyanPhone(phone: string) {
  const clean = phone.trim().replace(/[^0-9+]/g, '')
  if (clean.startsWith('+254')) return clean
  if (clean.startsWith('254')) return `+${clean}`
  if (clean.startsWith('0') && clean.length === 10) return `+254${clean.slice(1)}`
  return clean
}

function phoneForMpesa(phone: string) {
  return normalizeKenyanPhone(phone).replace(/\D/g, '')
}

function Index() {
  const [catalog, setCatalog] = useState<{ products: CatalogProduct[]; slots: CatalogSlot[] }>({ products: [], slots: [] })
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [view, setView] = useState<'home' | 'shop' | 'orders' | 'admin' | 'rider' | 'account'>('home')
  const [authOpen, setAuthOpen] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [authPhone, setAuthPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [address, setAddress] = useState({ block: '', house: '', gate: '' })
  const [slotId, setSlotId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('mpesa_stk')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [adminFilter, setAdminFilter] = useState('all')
  const [mobileNav, setMobileNav] = useState(false)

  const loadSession = async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (data.session?.user) await loadProfile(data.session.user.id)
    else { setProfile(null); setOrders([]) }
  }
  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data as Profile)
      setAddress({ block: data.block ?? '', house: data.house_number ?? '', gate: data.gate_instructions ?? '' })
    }
  }
  const loadOrders = async () => {
    if (!session?.user?.id) return
    const role = await getRole(session.user.id)
    const query = role === 'admin' ? supabase.from('orders').select('*').order('created_at', { ascending: false }) : role === 'rider' ? supabase.from('orders').select('*').eq('rider_id', session.user.id).order('created_at', { ascending: false }) : supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    const { data } = await query
    setOrders((data ?? []) as Order[])
  }
  const getRole = async (userId: string) => {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId)
    const roles = (data ?? []).map((x: any) => x.role)
    return roles.includes('admin') ? 'admin' : roles.includes('rider') ? 'rider' : 'user'
  }
  const loadRiders = async () => { const { data } = await supabase.from('profiles').select('id, full_name, phone').in('id', (await supabase.from('user_roles').select('user_id').eq('role', 'rider')).data?.map((x: any) => x.user_id) ?? []); setRiders((data ?? []) as Rider[]) }

  useEffect(() => { getCatalog().then(setCatalog).catch(() => setNotice('Connect your Supabase database to load the live catalogue.')); loadSession(); const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (s?.user) loadProfile(s.user.id) }); return () => sub.subscription.unsubscribe() }, [])
  useEffect(() => { if (session?.user?.id) { loadOrders(); getRole(session.user.id).then(role => { if (role === 'admin') loadRiders() }) } }, [session?.user?.id])

  const total = useMemo(() => catalog.products.reduce((sum, p) => sum + (cart[p.id] ?? 0) * (Number(p.price_kes) + Number(p.deposit_kes)), 0), [cart, catalog.products])
  const cartCount = Object.values(cart).reduce<number>((a, b) => a + Number(b), 0)
  const chosenProducts = catalog.products.filter(p => (cart[p.id] ?? 0) > 0)

  const sendOtp = async () => {
    const p = normalizeKenyanPhone(authPhone)
    if (!/^\+254[17]\d{8}$/.test(p)) {
      setNotice('Enter a valid Kenyan mobile number, for example 0712 345 678.')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: p })
    setBusy(false)
    if (error) {
      console.error('[Auth] OTP request failed:', error)
      setNotice(error.message || 'We could not send the verification code. Check your Supabase phone-auth settings.')
      return
    }
    setOtpSent(true)
    setNotice('We sent a verification code to your phone.')
  }
  const verifyOtp = async () => { setBusy(true); const { error } = await supabase.auth.verifyOtp({ phone: normalizeKenyanPhone(authPhone), token: otp, type: 'sms' }); setBusy(false); if (error) setNotice(error.message); else { setAuthOpen(false); setOtpSent(false); setOtp(''); setNotice('Welcome to Upstream.') } }

  const placeOrder = async () => {
    if (!session) { setAuthOpen(true); return }
    if (!chosenProducts.length || !address.block || !address.house || !slotId) { setNotice('Choose your water, block, house number and delivery slot.'); return }
    setBusy(true)
    const { data: order, error } = await supabase.from('orders').insert({ user_id: session.user.id, payment_method: paymentMethod, delivery_slot_id: slotId, delivery_date: new Date().toISOString().slice(0,10), total_kes: total, block: address.block, house_number: address.house, gate_instructions: address.gate, status: paymentMethod === 'mpesa_stk' ? 'pending_payment' : 'confirmed' }).select().single()
    if (error || !order) { setBusy(false); setNotice(error?.message ?? 'Could not create order.'); return }
    const items = chosenProducts.map(p => ({ order_id: order.id, product_id: p.id, product_name: p.name, quantity: cart[p.id], unit_price: Number(p.price_kes), deposit_kes: Number(p.deposit_kes), line_total: cart[p.id] * (Number(p.price_kes) + Number(p.deposit_kes)) }))
    const { error: itemError } = await supabase.from('order_items').insert(items)
    if (itemError) { setBusy(false); setNotice(itemError.message); return }
    await supabase.from('profiles').update({ block: address.block, house_number: address.house, gate_instructions: address.gate }).eq('id', session.user.id)
    setCart({}); setCheckoutOpen(false); setSelectedOrder(order.id); setView('orders')
    if (paymentMethod === 'mpesa_stk') {
      try { await startMpesaPayment({ data: { orderId: order.id, amount: total, phone: phoneForMpesa(profile?.phone || authPhone), reference: order.order_number } }); setNotice('M-Pesa prompt sent. Enter your PIN on your phone, then refresh your order status.') } catch (e: any) { setNotice(e?.message ?? 'M-Pesa could not start. You can retry from the order.') }
    } else setNotice('Order received. We will prepare it for delivery.')
    setBusy(false); await loadOrders()
  }

  const updateOrder = async (id: string, patch: Partial<Order>) => { setBusy(true); await supabase.from('orders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); setBusy(false); await loadOrders() }
  const signOut = async () => { await supabase.auth.signOut(); setView('home'); setNotice('Signed out.') }

  const rolePromise = session?.user?.id ? getRole(session.user.id) : Promise.resolve('user')
  const [currentRole, setCurrentRole] = useState<'admin'|'rider'|'user'>('user')
  useEffect(() => { rolePromise.then(r => setCurrentRole(r as any)) }, [session?.user?.id])

  const nav = (next: typeof view) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return <div className="min-h-screen bg-[#f4f9fc] text-slate-900">
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button onClick={() => nav('home')} className="flex items-center gap-3 text-left"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-700 text-white shadow-lg shadow-blue-200"><Droplets size={24}/></span><span><span className="block font-display text-xl font-extrabold tracking-tight text-slate-950">UPSTREAM</span><span className="block text-[10px] font-bold uppercase tracking-[.24em] text-cyan-700">Water delivery</span></span></button>
        <nav className="hidden items-center gap-1 md:flex">
          <NavButton active={view==='home'} onClick={()=>nav('home')}>Home</NavButton><NavButton active={view==='shop'} onClick={()=>nav('shop')}>Order water</NavButton>{session && <NavButton active={view==='orders'} onClick={()=>nav('orders')}>My orders</NavButton>}{currentRole==='admin' && <NavButton active={view==='admin'} onClick={()=>nav('admin')}>Operations</NavButton>}{currentRole==='rider' && <NavButton active={view==='rider'} onClick={()=>nav('rider')}>Rider</NavButton>}
        </nav>
        <div className="flex items-center gap-2"><button onClick={()=>nav('shop')} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50"><ShoppingBag size={19}/>{cartCount>0&&<span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold text-white">{cartCount}</span>}</button>{session ? <button onClick={()=>nav('account')} className="hidden items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white sm:flex"><CircleUserRound size={17}/>{profile?.full_name || 'Account'}</button> : <button onClick={()=>setAuthOpen(true)} className="hidden items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white sm:flex"><LogIn size={16}/>Sign in</button>}<button className="grid h-10 w-10 place-items-center rounded-xl border md:hidden" onClick={()=>setMobileNav(v=>!v)}><Menu size={19}/></button></div>
      </div>
      {mobileNav&&<div className="border-t bg-white px-4 py-3 md:hidden"><div className="grid gap-1">{[['home','Home'],['shop','Order water'],['orders','My orders'],...(currentRole==='admin'?[['admin','Operations']]:[]),...(currentRole==='rider'?[['rider','Rider']]:[])].map(([k,l])=><button key={k} onClick={()=>nav(k as any)} className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-slate-50">{l}</button>)}{session?<button onClick={signOut} className="mt-1 rounded-xl px-3 py-3 text-left font-semibold text-red-600">Sign out</button>:<button onClick={()=>{setAuthOpen(true);setMobileNav(false)}} className="mt-1 rounded-xl bg-slate-950 px-3 py-3 text-left font-semibold text-white">Sign in</button>}</div></div>}
    </header>

    {notice&&<div className="fixed inset-x-0 top-[68px] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-2xl"><div className="flex items-center gap-3"><Bell size={16} className="text-cyan-600"/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div></div>}

    {view==='home'&&<HomeView onOrder={()=>nav('shop')} session={session} onSignIn={()=>setAuthOpen(true)} />}
    {view==='shop'&&<ShopView products={catalog.products} cart={cart} setCart={setCart} total={total} onCheckout={()=>setCheckoutOpen(true)} />}
    {view==='orders'&&<OrdersView orders={orders} selectedOrder={selectedOrder} setSelectedOrder={setSelectedOrder} slots={catalog.slots} onRefresh={loadOrders} />}
    {view==='admin'&&currentRole==='admin'&&<AdminView orders={orders} riders={riders} slots={catalog.slots} onUpdate={updateOrder} filter={adminFilter} setFilter={setAdminFilter} />}
    {view==='rider'&&currentRole==='rider'&&<RiderView orders={orders} onUpdate={updateOrder} />}
    {view==='account'&&<AccountView profile={profile} onSignOut={signOut} onSave={async p=>{await supabase.from('profiles').update(p).eq('id',session.user.id);await loadProfile(session.user.id);setNotice('Profile saved.')}} />}

    <footer className="border-t bg-slate-950 text-slate-300"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8"><div><div className="flex items-center gap-2 text-white"><Droplets size={20}/><span className="font-display font-extrabold">UPSTREAM</span></div><p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Reliable drinking water delivered to your door in Greenpark Estate.</p></div><div><p className="font-bold text-white">Delivery</p><p className="mt-3 text-sm text-slate-400">Morning · Afternoon · Evening</p><p className="mt-1 text-sm text-slate-400">Order before the cut-off for same-day delivery.</p></div><div><p className="font-bold text-white">Need help?</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><Phone size={15}/> Customer support</p><p className="mt-1 flex items-center gap-2 text-sm text-slate-400"><MapPin size={15}/> Greenpark Estate</p></div></div><div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} Upstream Water Delivery</div></footer>

    {authOpen&&<Modal onClose={()=>setAuthOpen(false)} title="Sign in to Upstream"><div className="space-y-4"><div className="rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-900"><Smartphone size={18} className="mb-2"/><b>Phone verification</b><p className="mt-1 text-cyan-800/80">We use your phone number to keep your orders and delivery address together.</p></div><label className="field"><span>Phone number</span><input value={authPhone} onChange={e=>setAuthPhone(e.target.value)} placeholder="07XX XXX XXX" inputMode="tel" disabled={otpSent}/></label>{otpSent&&<label className="field"><span>Verification code</span><input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6}/></label>}{!otpSent?<button disabled={busy||!authPhone} onClick={sendOtp} className="primary-btn w-full">{busy?'Sending…':'Send code'} <ArrowRight size={17}/></button>:<><button disabled={busy||otp.length<4} onClick={verifyOtp} className="primary-btn w-full">{busy?'Checking…':'Verify & continue'} <Check size={17}/></button><button onClick={()=>setOtpSent(false)} className="w-full rounded-xl py-2 text-sm font-bold text-slate-500">Use another number</button></>}</div></Modal>}
    {checkoutOpen&&<Modal onClose={()=>setCheckoutOpen(false)} title="Complete your order"><div className="space-y-5"><div className="space-y-2">{chosenProducts.map(p=><div key={p.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{p.name} × {cart[p.id]}</span><b>{money(cart[p.id]*(Number(p.price_kes)+Number(p.deposit_kes)))}</b></div>)}</div><div className="grid gap-3 sm:grid-cols-2"><label className="field"><span>Block</span><input value={address.block} onChange={e=>setAddress({...address,block:e.target.value})} placeholder="e.g. Block C"/></label><label className="field"><span>House number</span><input value={address.house} onChange={e=>setAddress({...address,house:e.target.value})} placeholder="e.g. C-12"/></label></div><label className="field"><span>Gate instructions</span><textarea value={address.gate} onChange={e=>setAddress({...address,gate:e.target.value})} placeholder="Security gate, landmark, call on arrival…"/></label><label className="field"><span>Delivery slot</span><select value={slotId} onChange={e=>setSlotId(e.target.value)}><option value="">Choose a slot</option>{catalog.slots.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><div className="grid grid-cols-3 gap-2"><PayOption active={paymentMethod==='mpesa_stk'} onClick={()=>setPaymentMethod('mpesa_stk')} icon={<Smartphone size={18}/>} label="M-Pesa"/><PayOption active={paymentMethod==='on_delivery_mpesa'} onClick={()=>setPaymentMethod('on_delivery_mpesa')} icon={<WalletCards size={18}/>} label="Pay M-Pesa"/><PayOption active={paymentMethod==='on_delivery_cash'} onClick={()=>setPaymentMethod('on_delivery_cash')} icon={<Package size={18}/>} label="Cash"/></div><div className="flex items-end justify-between border-t pt-4"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total</p><p className="font-display text-2xl font-extrabold">{money(total)}</p></div><button onClick={placeOrder} disabled={busy} className="primary-btn">{busy?'Processing…':'Place order'} <ArrowRight size={17}/></button></div></div></Modal>}
  </div>
}

function NavButton({active,onClick,children}:{active:boolean;onClick:()=>void;children:ReactNode}){return <button onClick={onClick} className={`rounded-xl px-3 py-2 text-sm font-bold transition ${active?'bg-cyan-50 text-cyan-800':'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{children}</button>}
function HomeView({ onOrder, session, onSignIn }: { onOrder: () => void; session: any; onSignIn: () => void }) {
  return (
    <main>
      <section className="surface-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(103,232,249,.25),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(59,130,246,.25),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-28">
          <div className="max-w-2xl text-white">
            <span className="eyebrow bg-white/10 text-cyan-100">GREENPARK ESTATE · ON-DEMAND DELIVERY</span>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-7xl">
              Fresh water.<br /><span className="text-cyan-200">Right to your door.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-50/85">
              Order your 20L refill or bottled water in a few taps. Choose a delivery slot, pay by M-Pesa, and follow every step.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={onOrder} className="primary-btn bg-white text-slate-950 hover:bg-cyan-50">Order water <ArrowRight size={18} /></button>
              {!session && <button onClick={onSignIn} className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-bold text-white backdrop-blur hover:bg-white/15">Sign in</button>}
            </div>
            <div className="mt-9 grid max-w-lg grid-cols-3 gap-3 text-sm">
              <HeroStat icon={<Zap size={17} />} text="Fast delivery" />
              <HeroStat icon={<ShieldCheck size={17} />} text="Secure payments" />
              <HeroStat icon={<RefreshCw size={17} />} text="Easy reorder" />
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-5 rounded-[3rem] bg-cyan-300/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.2rem] border border-white/15 bg-white/10 p-2 shadow-2xl backdrop-blur">
              <div className="grid min-h-[430px] place-items-center rounded-[1.8rem] bg-gradient-to-br from-cyan-200 via-blue-300 to-blue-700 p-8">
                <div className="text-center text-white">
                  <div className="mx-auto grid h-28 w-28 place-items-center rounded-[2rem] bg-white/20 shadow-xl backdrop-blur"><Droplets size={68} /></div>
                  <p className="mt-7 font-display text-3xl font-extrabold">20L, delivered.</p>
                  <p className="mt-2 text-white/80">Reliable water for everyday living.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <Feature icon={<ShoppingBag />} title="Choose your water" text="20L refills, new bottles and convenient bottled-water packs." />
          <Feature icon={<CalendarClock />} title="Pick your time" text="Morning, afternoon or evening delivery slots built for Greenpark." />
          <Feature icon={<Truck />} title="Track the delivery" text="See when your order is confirmed, packed, on the way and delivered." />
        </div>
      </section>

      <section className="surface-foam border-y">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div><span className="eyebrow">HOW IT WORKS</span><h2 className="section-title">Water delivery without the back-and-forth.</h2></div>
          <div className="grid gap-3">
            {['Order in under a minute', 'Pay securely with M-Pesa or choose pay-on-delivery', 'Get your delivery status and rider details', 'Return your empty 20L bottle on the next delivery'].map((x, i) => (
              <div key={x} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-100 font-display font-extrabold text-cyan-800">{i + 1}</span>
                <div><p className="font-bold">{x}</p><p className="mt-1 text-sm text-slate-500">Designed around the way Greenpark households actually order.</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function HeroStat({icon,text}:{icon:ReactNode;text:string}){return <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur"><span className="text-cyan-200">{icon}</span><span className="font-semibold text-white/90">{text}</span></div>}
function Feature({icon,title,text}:{icon:ReactNode;title:string;text:string}){return <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">{icon}</div><h3 className="mt-5 font-display text-xl font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>}
function ShopView({products,cart,setCart,total,onCheckout}:{products:CatalogProduct[];cart:Record<string,number>;setCart:Dispatch<SetStateAction<Record<string,number>>>;total:number;onCheckout:()=>void}){return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="eyebrow">UPSTREAM SHOP</span><h1 className="section-title">Choose your water.</h1><p className="mt-2 max-w-xl text-slate-500">Fresh, simple and delivered to your Greenpark home.</p></div>{Object.keys(cart).length>0&&<button onClick={onCheckout} className="primary-btn">Checkout · {money(total)} <ArrowRight size={17}/></button>}</div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(p=><ProductCard key={p.id} product={p} qty={cart[p.id]??0} onChange={qty=>setCart(c=>({...c,[p.id]:Math.max(0,qty)}))}/>)}</div></main>}
function ProductCard({product,qty,onChange}:{product:CatalogProduct;qty:number;onChange:(q:number)=>void}){return <article className={`group rounded-[1.7rem] border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${qty?'border-cyan-300 ring-2 ring-cyan-100':'border-slate-200'}`}><div className="flex items-start justify-between"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-100 text-cyan-700"><Droplets size={28}/></div>{qty>0&&<span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">{qty} selected</span>}</div><p className="mt-6 text-xs font-bold uppercase tracking-widest text-cyan-700">{product.size_label}</p><h3 className="mt-1 font-display text-2xl font-extrabold">{product.name}</h3><p className="mt-2 min-h-12 text-sm leading-5 text-slate-500">{product.description}</p><div className="mt-5 flex items-end justify-between gap-3"><div><p className="font-display text-xl font-extrabold">{money(Number(product.price_kes))}</p>{Number(product.deposit_kes)>0&&<p className="text-xs font-semibold text-slate-400">+ {money(Number(product.deposit_kes))} refundable deposit</p>}</div><div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"><button onClick={()=>onChange(qty-1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"><Minus size={16}/></button><span className="w-7 text-center text-sm font-extrabold">{qty}</span><button onClick={()=>onChange(qty+1)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white hover:bg-slate-800"><Plus size={16}/></button></div></div></article>}
function OrdersView({orders,selectedOrder,setSelectedOrder,slots,onRefresh}:{orders:Order[];selectedOrder:string|null;setSelectedOrder:(s:string|null)=>void;slots:CatalogSlot[];onRefresh:()=>Promise<void>}){return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8"><div className="flex items-end justify-between"><div><span className="eyebrow">YOUR WATER</span><h1 className="section-title">Orders & tracking</h1></div><button onClick={onRefresh} className="icon-btn"><RefreshCw size={17}/></button></div>{!orders.length?<Empty title="No orders yet" text="Your completed and current orders will appear here."/>:<div className="mt-8 grid gap-5 lg:grid-cols-2">{orders.map(o=><OrderCard key={o.id} order={o} selected={selectedOrder===o.id} onSelect={()=>setSelectedOrder(selectedOrder===o.id?null:o.id)} slot={slots.find(s=>s.id===o.delivery_slot_id)}/>)}</div>}</main>}
function OrderCard({order,selected,onSelect,slot}:{order:Order;selected:boolean;onSelect:()=>void;slot?:CatalogSlot}){const steps=['confirmed','packed','out_for_delivery','delivered'];const current=steps.indexOf(order.status);return <article className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm"><button onClick={onSelect} className="w-full p-5 text-left"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{order.order_number}</p><h3 className="mt-1 font-display text-xl font-extrabold">{money(Number(order.total_kes))}</h3></div><StatusBadge status={order.status}/></div><div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><MapPin size={15}/>{order.block} · {order.house_number}<span className="text-slate-300">•</span><Clock3 size={15}/>{slot?.label ?? 'Delivery slot'}</div></button>{selected&&<div className="border-t bg-slate-50 p-5"><div className="relative ml-2 space-y-4">{steps.map((s,i)=>{const done=current>=i || order.status==='delivered';const M=statusMeta[s].icon;return <div key={s} className="relative flex items-center gap-3"><span className={`grid h-8 w-8 place-items-center rounded-full ${done?'bg-cyan-600 text-white':'bg-white text-slate-300 ring-1 ring-slate-200'}`}><M size={15}/></span><div><p className={`text-sm font-bold ${done?'text-slate-900':'text-slate-400'}`}>{statusMeta[s].label}</p>{i===0&&<p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleString('en-KE')}</p>}</div></div>})}</div>{order.status==='out_for_delivery'&&<div className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Truck size={19}/></div><div><p className="font-bold">Your rider is on the way</p><p className="text-xs text-slate-500">They will call if they need help finding your gate.</p></div></div>}</div>}</article>}
function AdminView({orders,riders,slots,onUpdate,filter,setFilter}:{orders:Order[];riders:Rider[];slots:CatalogSlot[];onUpdate:(id:string,p:Partial<Order>)=>Promise<void>;filter:string;setFilter:(s:string)=>void}){const filtered=filter==='all'?orders:orders.filter(o=>o.status===filter);return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div><span className="eyebrow">OPERATIONS</span><h1 className="section-title">Today's delivery board.</h1><p className="mt-2 text-slate-500">Confirm payments, assign riders and move every order through the delivery flow.</p></div><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Orders" value={orders.length}/><Metric label="Pending" value={orders.filter(o=>o.status==='pending_payment').length}/><Metric label="On the way" value={orders.filter(o=>o.status==='out_for_delivery').length}/><Metric label="Delivered" value={orders.filter(o=>o.status==='delivered').length}/></div><div className="mt-8 flex gap-2 overflow-auto pb-1">{['all','pending_payment','confirmed','packed','out_for_delivery','delivered'].map(s=><button key={s} onClick={()=>setFilter(s)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-extrabold ${filter===s?'bg-slate-950 text-white':'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{s==='all'?'All':statusMeta[s]?.label}</button>)}</div><div className="mt-5 grid gap-4">{filtered.map(o=><AdminOrder key={o.id} order={o} riders={riders} slots={slots} onUpdate={onUpdate}/>)}</div></main>}
function AdminOrder({order,riders,onUpdate}:{order:Order;riders:Rider[];slots:CatalogSlot[];onUpdate:(id:string,p:Partial<Order>)=>Promise<void>}){return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-display font-extrabold">{order.order_number}</span><StatusBadge status={order.status}/><span className="text-xs font-semibold text-slate-400">{new Date(order.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</span></div><p className="mt-2 text-sm font-bold">{order.block} · {order.house_number}</p><p className="mt-1 text-xs text-slate-500">{order.gate_instructions||'No gate instructions'} · {money(Number(order.total_kes))}</p></div><div className="flex flex-wrap gap-2"><select value={order.rider_id??''} onChange={e=>onUpdate(order.id,{rider_id:e.target.value||null})} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"><option value="">Assign rider</option>{riders.map(r=><option key={r.id} value={r.id}>{r.full_name||r.phone}</option>)}</select><select value={order.status} onChange={e=>onUpdate(order.id,{status:e.target.value})} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div></div></div>}
function RiderView({orders,onUpdate}:{orders:Order[];onUpdate:(id:string,p:Partial<Order>)=>Promise<void>}){const [customers,setCustomers]=useState<Record<string,string>>({}); useEffect(()=>{const ids=[...new Set(orders.map(o=>o.user_id))]; if(ids.length) supabase.from('profiles').select('id,phone').in('id',ids).then(({data})=>setCustomers(Object.fromEntries((data??[]).map((p:any)=>[p.id,p.phone]))))},[orders]); const active=orders.filter(o=>o.status!=='delivered'&&o.status!=='cancelled');return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><span className="eyebrow">RIDER APP</span><h1 className="section-title">Today's deliveries.</h1><p className="mt-2 text-slate-500">Keep it simple: call, deliver, collect empties and move on.</p><div className="mt-8 grid gap-4">{active.map(o=><div key={o.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Bike size={23}/></div><div><div className="flex items-center gap-2"><span className="font-display font-extrabold">{o.order_number}</span><StatusBadge status={o.status}/></div><p className="mt-1 font-bold">{o.block} · {o.house_number}</p><p className="mt-1 text-sm text-slate-500">{o.gate_instructions||'No gate instructions'}</p></div></div><div className="flex gap-2"><a href={`tel:${customers[o.user_id] ?? ''}`} className="icon-btn" aria-label="Call customer"><Phone size={17}/></a>{o.status==='confirmed'&&<button onClick={()=>onUpdate(o.id,{status:'packed'})} className="primary-btn">Packed</button>}{o.status==='packed'&&<button onClick={()=>onUpdate(o.id,{status:'out_for_delivery'})} className="primary-btn">Start route</button>}{o.status==='out_for_delivery'&&<button onClick={()=>onUpdate(o.id,{status:'delivered',delivered_at:new Date().toISOString()})} className="primary-btn">Mark delivered</button>}</div></div></div>)}</div></main>}
function AccountView({profile,onSignOut,onSave}:{profile:Profile|null;onSignOut:()=>void;onSave:(p:any)=>Promise<void>}){const [name,setName]=useState(profile?.full_name??'');const [phone,setPhone]=useState(profile?.phone??'');return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8"><span className="eyebrow">ACCOUNT</span><h1 className="section-title">Your delivery details.</h1><div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm"><div className="grid gap-4"><label className="field"><span>Full name</span><input value={name} onChange={e=>setName(e.target.value)}/></label><label className="field"><span>Phone</span><input value={phone} disabled/></label><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-cyan-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Wallet</p><p className="mt-2 font-display text-2xl font-extrabold">{money(Number(profile?.wallet_balance??0))}</p></div><div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Bottles with you</p><p className="mt-2 font-display text-2xl font-extrabold">{profile?.bottles_with_customer??0} × 20L</p></div></div><div className="flex flex-wrap gap-2 pt-2"><button onClick={()=>onSave({full_name:name})} className="primary-btn">Save changes <Check size={16}/></button><button onClick={onSignOut} className="rounded-xl border border-red-200 px-4 py-2.5 font-bold text-red-600"><LogOut size={16}/></button></div></div></div></main>}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-2 font-display text-2xl font-extrabold">{value}</p></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="mt-10 rounded-3xl border border-dashed bg-white p-12 text-center"><Package className="mx-auto text-slate-300" size={34}/><h3 className="mt-4 font-display text-xl font-extrabold">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></div>}
function StatusBadge({status}:{status:string}){const good=['confirmed','packed','out_for_delivery','delivered'].includes(status);return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${status==='pending_payment'?'bg-amber-50 text-amber-700':status==='cancelled'?'bg-red-50 text-red-700':good?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{statusMeta[status]?.label??status}</span>}
function PayOption({active,onClick,icon,label}:{active:boolean;onClick:()=>void;icon:ReactNode;label:string}){return <button onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active?'border-cyan-500 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-100':'border-slate-200 bg-white text-slate-600'}`}><div>{icon}</div><p className="mt-1 text-xs font-bold">{label}</p></button>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[2rem] bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-2xl font-extrabold">{title}</h2><button onClick={onClose} className="icon-btn"><X size={18}/></button></div>{children}</div></div>}
