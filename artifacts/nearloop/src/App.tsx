import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type ChangeEvent, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, ChevronDown, ChevronRight, Clock3, Compass,
  Crown, ExternalLink, Eye, LayoutDashboard, LifeBuoy, LockKeyhole, MapPin, MessageCircle, Package, Plus,
  Search, Send, ShieldCheck, Store, Trash2, TrendingUp, Upload, UserRound, X,
} from 'lucide-react';
import { AdminWorkspace } from './AdminWorkspace';
import {
  Route, Switch, Router as WouterRouter, Link, Redirect, useLocation, useParams,
} from 'wouter';
import {
  getGetCatalogQueryKey, getGetCurrentUserQueryKey,
  getGetMySubscriptionQueryKey, getGetSellerOverviewQueryKey, getGetSellerShopStatusQueryKey,
  getListCategoriesQueryKey, getListConversationsQueryKey, getListMessagesQueryKey,
  getListNotificationsQueryKey, getListSellerProductsQueryKey, getSearchProductsQueryKey,
  getSearchShopsQueryKey, useCompleteTestPayment, useCreateSellerProduct, useDeleteSellerProduct,
  useGetCatalog, useGetCurrentUser, useGetMySubscription, useGetProduct, useGetSellerOverview,
  useGetSellerShopStatus, useGetShop, useHealthCheck, useListCategories, useListConversations, useListMessages,
  useListNotifications, useListSellerProducts, useMarkNotificationRead, useResubmitShopApplication,
  useSearchProducts, useSearchShops, useSendMessage, useStartConversation,
  useStartSubscription, useSubmitComplaint, useSubmitShopApplication,
  useUpdateCurrentUser, useUpdateSellerProduct, type Product, type Shop,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function imageSrc(value: string | null) {
  return value?.startsWith('/api/') ? `${basePath}${value}` : value;
}
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#344fc0', colorForeground: '#252d48', colorMutedForeground: '#747b91',
    colorDanger: '#c44646', colorBackground: '#ffffff', colorInput: '#fbfbfd',
    colorInputForeground: '#252d48', colorNeutral: '#e4e6ed', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#252d48] font-bold', headerSubtitle: 'text-[#747b91]',
    socialButtonsBlockButtonText: 'text-[#252d48] font-semibold', formFieldLabel: 'text-[#343b55] font-semibold',
    footerActionLink: 'text-[#344fc0] font-semibold', footerActionText: 'text-[#747b91]',
    dividerText: 'text-[#747b91]', identityPreviewEditButton: 'text-[#344fc0]',
    formFieldSuccessText: 'text-emerald-700', alertText: 'text-[#252d48]', logoBox: 'rounded-xl',
    logoImage: 'rounded-lg', socialButtonsBlockButton: 'border-[#e4e6ed] bg-white rounded-xl',
    formButtonPrimary: 'bg-[#344fc0] hover:bg-[#293fa5] rounded-xl font-bold',
    formFieldInput: 'border-[#e4e6ed] bg-[#fbfbfd] rounded-xl text-[#252d48]',
    footerAction: 'border-t border-[#e4e6ed]', dividerLine: 'bg-[#e4e6ed]',
    alert: 'rounded-xl', otpCodeFieldInput: 'rounded-lg border-[#e4e6ed]', formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function cx(...parts: (string | false | undefined | null)[]) { return parts.filter(Boolean).join(' '); }
function usePin() {
  const [pin, setPin] = useState(() => typeof window !== 'undefined' ? window.localStorage.getItem('nearloop.pin') || '' : '');
  useEffect(() => {
    const syncPin = () => setPin(window.localStorage.getItem('nearloop.pin') || '');
    window.addEventListener('nearloop-pin-change', syncPin);
    return () => window.removeEventListener('nearloop-pin-change', syncPin);
  }, []);
  const savePin = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setPin(clean);
    if (clean.length === 6) window.localStorage.setItem('nearloop.pin', clean);
    else window.localStorage.removeItem('nearloop.pin');
    window.dispatchEvent(new Event('nearloop-pin-change'));
  };
  return [pin, savePin] as const;
}
function Button({ children, onClick, kind = 'primary', type = 'button', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'outline' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={cx('btn', kind === 'primary' ? 'btn-primary' : kind === 'secondary' ? 'btn-secondary' : kind === 'danger' ? 'bg-red-50 text-red-700' : 'btn-outline', disabled && 'cursor-not-allowed opacity-50', className)}>{children}</button>;
}
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return <label className="block space-y-1.5">{label && <span className="text-sm font-semibold">{label}</span>}<input className="field" {...props} /></label>;
}
function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return <label className="block space-y-1.5">{label && <span className="text-sm font-semibold">{label}</span>}<textarea className="field min-h-28 resize-y" {...props} /></label>;
}
function PageTitle({ kicker, title, note, action }: { kicker?: string; title: string; note?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{kicker && <div className="micro-label mb-2">{kicker}</div>}<h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>{note && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{note}</p>}</div>{action}</div>;
}
function Loading({ label = 'Finding what’s nearby' }: { label?: string }) {
  return <div className="space-y-3 py-5" role="status" aria-label={label}><div className="skeleton h-32 w-full" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div></div>;
}
function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <div className="surface mx-auto max-w-lg p-8 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700"><LifeBuoy size={22}/></div><h2 className="font-display text-xl font-bold">That didn’t load</h2><p className="mt-2 text-sm text-muted-foreground">We couldn’t reach this neighborhood just now. Try again in a moment.</p>{onRetry && <Button className="mt-5" onClick={onRetry}>Try again</Button>}</div>;
}
function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="surface px-6 py-12 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-secondary text-secondary-foreground"><Compass size={25}/></div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function Header() {
  const [pin, setPin] = usePin();
  const [draft, setDraft] = useState(pin);
  const { isSignedIn } = useAuth();
  return <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
    <div className="nearloop-main flex h-[72px] items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-2.5" data-testid="link-nearloop-home"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-white"><MapPin size={20} strokeWidth={2.5}/></span><span><b className="font-display text-[18px] tracking-tight">nearloop</b><span className="hidden pl-2 text-xs text-muted-foreground sm:inline">Shop Local. Discover Nearby.</span></span></Link>
      <nav className="hidden items-center gap-6 text-sm font-semibold md:flex"><Link href="/shops" className="text-muted-foreground hover:text-foreground">Shops</Link><Link href="/products" className="text-muted-foreground hover:text-foreground">Find a product</Link><Link href="/help" className="text-muted-foreground hover:text-foreground">How it works</Link></nav>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 sm:flex"><MapPin size={15} className="text-primary"/><input aria-label="Your PIN code" data-testid="input-header-pin" className="w-[92px] bg-transparent text-sm font-semibold outline-none" value={draft} placeholder="6-digit PIN" maxLength={6} inputMode="numeric" onChange={e=>setDraft(e.target.value.replace(/\D/g,'').slice(0,6))} onBlur={()=>draft.length===6&&setPin(draft)} onKeyDown={e=>e.key==='Enter'&&draft.length===6&&setPin(draft)}/>{draft.length===6 && <button aria-label="Set PIN" data-testid="button-save-pin" onClick={()=>setPin(draft)}><Check size={15} className="text-emerald-600"/></button>}</div>
        <Link href={isSignedIn ? '/profile' : '/sign-in'} className="btn btn-outline h-10 min-h-10 px-3 text-sm"><UserRound size={16}/><span className="hidden sm:inline">{isSignedIn ? 'Profile' : 'Sign in'}</span></Link>
      </div>
    </div>
  </header>;
}
function BottomNav() {
  const [loc] = useLocation();
  const entries = [{href:'/',label:'Home',Icon:Compass},{href:'/shops',label:'Search',Icon:Search},{href:'/messages',label:'Messages',Icon:MessageCircle},{href:'/profile',label:'Profile',Icon:UserRound}];
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-3 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden" aria-label="Primary navigation"><div className="mx-auto flex max-w-lg justify-around">{entries.map(({href,label,Icon})=><Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`} className={cx('flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-semibold',loc===href?'text-primary':'text-muted-foreground')}><Icon size={19}/>{label}</Link>)}</div></nav>;
}
function Shell({ children }: { children: ReactNode }) {
  return <div className="nearloop-shell noise"><Header/><main className="nearloop-main bottom-safe page-enter py-8 md:py-11">{children}</main><footer className="nearloop-main hidden border-t border-border py-6 text-xs text-muted-foreground md:block">A better way to meet the shops just around the corner.</footer><BottomNav/></div>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  useEffect(() => {
    let previous: string | null | undefined;
    const unsubscribe = addListener(({ user }) => {
      const next = user?.id ?? null;
      if (previous !== undefined && previous !== next) qc.clear();
      previous = next;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}
function Guard({ children, role }: { children: ReactNode; role?: 'seller' | 'admin' }) {
  const { isLoaded, isSignedIn } = useAuth();
  const user = useGetCurrentUser({ query: { enabled: !!isSignedIn, queryKey: getGetCurrentUserQueryKey() } });
  if (!isLoaded) return <Shell><Loading label="Checking your account"/></Shell>;
  if (!isSignedIn) return <Redirect to="/sign-in"/>;
  if (user.isLoading) return <Shell><Loading label="Loading your profile"/></Shell>;
  if (user.isError) return <Shell><ErrorState onRetry={()=>void user.refetch()}/></Shell>;
  if (role && user.data?.role !== role) return <Shell><Empty title="This area is for a different account" detail="Your account doesn’t have permission to view this page. If you think this is a mistake, contact the NearLoop team." action={<Link href="/" className="btn btn-primary">Back to nearby</Link>}/></Shell>;
  return <>{children}</>;
}
function Home() {
  const [pin, setPin] = usePin();
  const [draft, setDraft] = useState(pin);
  const [category, setCategory] = useState('');
  const key = useMemo(()=>getGetCatalogQueryKey(pin.length===6?{pinCode:pin,category:category||undefined}:undefined),[pin,category]);
  const catalog = useGetCatalog(pin.length===6?{pinCode:pin,category:category||undefined}:undefined,{query:{enabled:pin.length===6,queryKey:key}});
  const categories = useListCategories();
  const submitPin = (e: FormEvent) => { e.preventDefault(); if(draft.length===6){setPin(draft);}};
  return <Shell>
    <section className="relative overflow-hidden rounded-[28px] border border-[#e4e6ef] bg-gradient-to-br from-white via-white to-[#f0efff] px-6 py-9 shadow-sm md:px-12 md:py-14">
      <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[34px] border-[#e7e5fb] opacity-80"/><div className="pointer-events-none absolute right-[15%] top-[44%] h-16 w-16 rounded-[20px] rotate-12 bg-[#dfebff]"/>
      <div className="relative max-w-[640px]">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#f1efff] px-3 py-1.5 text-xs font-bold text-[#564ab4]"><BadgeCheck size={14}/>Your neighborhood, verified</div>
        <h1 className="font-display text-[42px] font-extrabold leading-[1.07] tracking-[-.045em] text-[#252d48] md:text-[62px]">Good things are<br className="hidden sm:block"/> closer than you think.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-[#6e748a]">Meet the independent shops in your lane. Browse what’s on their shelves, then talk directly with the people who run them.</p>
        <form onSubmit={submitPin} className="mt-8 flex max-w-lg flex-col gap-2 rounded-2xl border border-[#e4e6ef] bg-white p-2 shadow-[0_12px_32px_rgba(55,64,110,.08)] sm:flex-row">
          <div className="flex flex-1 items-center gap-3 px-3"><MapPin className="shrink-0 text-primary" size={19}/><input data-testid="input-home-pin" aria-label="Six digit PIN code" className="h-12 w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground" placeholder="Enter your 6-digit PIN code" value={draft} inputMode="numeric" maxLength={6} onChange={e=>setDraft(e.target.value.replace(/\D/g,'').slice(0,6))}/></div>
          <Button type="submit" disabled={draft.length!==6} className="h-12 px-5">Explore nearby <ArrowRight size={16}/></Button>
        </form>
        <p className="mt-3 pl-1 text-xs text-muted-foreground">We only show shops that serve this exact PIN code.</p>
      </div>
    </section>
    {pin.length!==6 ? <section className="mt-12 grid gap-7 md:grid-cols-[1fr_300px] md:items-center"><div><div className="micro-label mb-2">Small shops, big neighborhood energy</div><h2 className="font-display text-2xl font-extrabold">Start with the six digits on your doorstep.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Every listing is tied to a verified service PIN. No far-away results pretending to be local. Just people and products within reach.</p></div><div className="surface p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><LockKeyhole size={18}/></span><div><strong className="text-sm">Your location stays specific</strong><p className="mt-1 text-xs text-muted-foreground">We never broaden your search behind your back.</p></div></div></div></section>
      : <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="micro-label mb-1">Right around you</div><h2 className="font-display text-2xl font-extrabold">{pin} neighborhood picks</h2></div><div className="flex gap-2"><Link href="/shops" className="btn btn-outline min-h-9 px-3 text-xs">All shops <ArrowRight size={14}/></Link><Link href="/products" className="btn btn-outline min-h-9 px-3 text-xs">All products <ArrowRight size={14}/></Link></div></div>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1"><button onClick={()=>setCategory('')} className={cx('whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold',!category?'bg-primary text-white':'bg-card text-muted-foreground border border-border')}>Everything</button>{(categories.data||[]).map(c=><button key={c.id} onClick={()=>setCategory(c.slug)} className={cx('whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold',category===c.slug?'bg-primary text-white':'bg-card text-muted-foreground border border-border')}>{c.name}</button>)}</div>
        {catalog.isLoading?<Loading/>:catalog.isError?<ErrorState onRetry={()=>void catalog.refetch()}/>:!catalog.data?.shops.length&&!catalog.data?.products.length?<Empty title="Your local loop is just getting started" detail="There aren’t any verified listings for this PIN yet. Check back soon, or let a favorite shop know they can join NearLoop." action={<Link href="/seller/apply" className="btn btn-secondary">I run a local shop</Link>}/>:<><h3 className="mb-3 font-display text-lg font-bold">Shops to know</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalog.data.shops.slice(0,6).map(s=><ShopCard key={s.id} shop={s}/>)}</div><h3 className="mb-3 mt-8 font-display text-lg font-bold">On the shelves</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{catalog.data.products.slice(0,6).map(p=><ProductCard key={p.id} product={p}/>)}</div></>}
      </section>}
    <section className="mt-14 flex flex-col justify-between gap-5 rounded-[24px] bg-[#252d48] px-6 py-7 text-white sm:flex-row sm:items-center md:px-9"><div><div className="micro-label text-[#c3c7df]">For the neighborhood makers</div><h2 className="mt-2 font-display text-2xl font-extrabold">Your shop belongs in the loop.</h2><p className="mt-2 text-sm text-[#c3c7df]">Bring your products to nearby customers. No checkout, just real conversations.</p></div><Link href="/seller/apply" className="btn min-h-11 bg-white text-[#252d48]">List your shop <ArrowRight size={16}/></Link></section>
  </Shell>;
}
function Photo({ src, name, shape='rounded-2xl' }: {src:string|null;name:string;shape?:string}) {
  return <div className={cx('grid shrink-0 place-items-center overflow-hidden bg-[#eeedff] text-[#6457c5]',shape)}>{src?<img src={imageSrc(src)??undefined} alt={name} className="h-full w-full object-cover"/>:<span className="font-display text-2xl font-extrabold">{name.slice(0,1).toUpperCase()}</span>}</div>;
}
function ShopCard({shop}:{shop:Shop}) {
  return <Link href={`/shops/${shop.id}`} data-testid={`card-shop-${shop.id}`} className="surface group flex gap-4 p-4 transition-transform hover:-translate-y-0.5"><Photo src={shop.imageUrl} name={shop.name} shape="h-[76px] w-[76px] rounded-[18px]"/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="micro-label">{shop.category}</div><h3 className="mt-1 truncate font-display font-bold">{shop.name}</h3></div>{shop.isPremium&&<span title="Premium shop" className="rounded-lg bg-[#fff5da] p-1.5 text-[#a37216]"><Crown size={14}/></span>}</div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{shop.address}</p><div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary"><MapPin size={12}/>{shop.pinCode} <span className="ml-1 text-muted-foreground">· {shop.productCount} listings</span></div></div><ChevronRight size={17} className="mt-2 shrink-0 text-muted-foreground"/></Link>;
}
function ProductCard({product}:{product:Product}) {
  return <Link href={`/products/${product.id}`} data-testid={`card-product-${product.id}`} className="surface group flex gap-4 p-4 transition-transform hover:-translate-y-0.5"><Photo src={product.imageUrl} name={product.name} shape="h-[76px] w-[76px] rounded-[18px]"/><div className="min-w-0 flex-1"><div className="micro-label">{product.category}</div><h3 className="mt-1 truncate font-display font-bold">{product.name}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{product.shopName}</p><div className="mt-2 flex items-center justify-between"><span className="font-bold text-primary">₹{product.price.toLocaleString('en-IN')}</span><span className={cx('rounded-full px-2 py-1 text-[10px] font-bold',product.available?'bg-emerald-50 text-emerald-700':'bg-muted text-muted-foreground')}>{product.available?'Available':'Ask the shop'}</span></div></div></Link>;
}
function SearchPage({ kind }: {kind:'shops'|'products'}) {
  const [pin,setPin] = usePin(); const [draftPin,setDraftPin]=useState(pin); const [q,setQ]=useState(''); const [category,setCategory]=useState('');
  const categories=useListCategories();
  const shopKey=useMemo(()=>getSearchShopsQueryKey({pinCode:pin,q:q||undefined,category:category||undefined}),[pin,q,category]);
  const productKey=useMemo(()=>getSearchProductsQueryKey({pinCode:pin,q:q||undefined,category:category||undefined}),[pin,q,category]);
  const shops=useSearchShops({pinCode:pin,q:q||undefined,category:category||undefined},{query:{enabled:kind==='shops'&&pin.length===6,queryKey:shopKey}});
  const products=useSearchProducts({pinCode:pin,q:q||undefined,category:category||undefined},{query:{enabled:kind==='products'&&pin.length===6,queryKey:productKey}});
  const submit=(e:FormEvent)=>{e.preventDefault();if(draftPin.length===6)setPin(draftPin);};
  return <Shell><PageTitle kicker="Search the neighborhood" title={kind==='shops'?'Local shops':'Find something nearby'} note={kind==='shops'?'Search verified independent shops that serve your exact PIN code.':'Browse what nearby shop owners have listed, then ask them directly.'}/>
    <form onSubmit={submit} className="surface mb-5 flex flex-col gap-2 p-3 sm:flex-row"><label className="flex flex-1 items-center gap-3 px-2"><Search size={18} className="text-primary"/><input aria-label={`Search ${kind}`} data-testid={`input-${kind}-search`} className="h-11 w-full bg-transparent outline-none placeholder:text-muted-foreground" placeholder={kind==='shops'?'Shop name, category, or street':'Product name or category'} value={q} onChange={e=>setQ(e.target.value)}/></label><input aria-label="Exact six-digit PIN" data-testid={`input-${kind}-pin`} className="field sm:max-w-[175px]" placeholder="6-digit PIN" inputMode="numeric" maxLength={6} value={draftPin} onChange={e=>setDraftPin(e.target.value.replace(/\D/g,'').slice(0,6))}/><Button type="submit" disabled={draftPin.length!==6}><Search size={15}/> Search</Button></form>
    <div className="mb-6 flex gap-2 overflow-auto pb-1"><button onClick={()=>setCategory('')} className={cx('rounded-full px-4 py-2 text-xs font-bold',!category?'bg-primary text-white':'border border-border bg-card text-muted-foreground')}>All categories</button>{(categories.data||[]).map(c=><button key={c.id} onClick={()=>setCategory(c.slug)} className={cx('whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold',category===c.slug?'bg-primary text-white':'border border-border bg-card text-muted-foreground')}>{c.name}</button>)}</div>
    {pin.length!==6?<Empty title="Set your neighborhood first" detail="NearLoop only shows listings for the exact six-digit PIN you choose. Add it here to keep results close and relevant."/>:kind==='shops'?shops.isLoading?<Loading/>:shops.isError?<ErrorState onRetry={()=>void shops.refetch()}/>:!shops.data?.length?<Empty title="No shops matched this search" detail={`No verified shops found for ${pin}. Try another phrase or a different category.`}/>:<div className="grid gap-3 sm:grid-cols-2">{shops.data.map(s=><ShopCard key={s.id} shop={s}/>)}</div>:products.isLoading?<Loading/>:products.isError?<ErrorState onRetry={()=>void products.refetch()}/>:!products.data?.length?<Empty title="Nothing on the shelf yet" detail={`No listed products matched this search for ${pin}. Try a broader search.`}/>:<div className="grid gap-3 sm:grid-cols-2">{products.data.map(p=><ProductCard key={p.id} product={p}/>)}</div>}
  </Shell>;
}
function useStartChat() {
  const mutation=useStartConversation(); const [,setLocation]=useLocation(); const {isSignedIn}=useAuth();
  return (shopId:number,productId?:number|null)=>{if(!isSignedIn){setLocation('/sign-in');return;}mutation.mutate({data:{shopId,productId:productId??null}},{onSuccess:c=>{void queryClient.invalidateQueries({queryKey:getListConversationsQueryKey()});setLocation(`/messages/${c.id}`)}})};
}
function ShopDetail() {
  const {shopId}=useParams(); const id=Number(shopId); const query=useGetShop(id); const startChat=useStartChat(); const [,setLocation]=useLocation(); const report=useSubmitComplaint();
  const [reportOpen,setReportOpen]=useState(false); const [subject,setSubject]=useState(''); const [details,setDetails]=useState('');
  if(query.isLoading)return <Shell><Loading/></Shell>; if(query.isError||!query.data)return <Shell><ErrorState onRetry={()=>void query.refetch()}/></Shell>;
  const {shop,products}=query.data;
  const submitReport=(e:FormEvent)=>{e.preventDefault();report.mutate({data:{shopId:shop.id,subject,details}},{onSuccess:()=>{setReportOpen(false);setSubject('');setDetails('');}})};
  return <Shell><Link href="/shops" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={15}/> Back to shops</Link><section className="surface overflow-hidden"><div className="grid md:grid-cols-[1fr_1.15fr]"><div className="min-h-[240px] bg-[#eeedff] md:min-h-[350px]">{shop.imageUrl?<img src={shop.imageUrl} alt={shop.name} className="h-full max-h-[440px] w-full object-cover"/>:<div className="grid h-full min-h-[240px] place-items-center text-[#6457c5]"><Store size={74}/></div>}</div><div className="p-6 md:p-10"><div className="micro-label">{shop.category} · PIN {shop.pinCode}</div><h1 className="mt-2 font-display text-3xl font-extrabold md:text-4xl">{shop.name}</h1>{shop.isPremium&&<span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#fff5da] px-3 py-1 text-xs font-bold text-[#936813]"><Crown size={13}/> NearLoop Premium</span>}<p className="mt-5 leading-7 text-muted-foreground">{shop.description||'A local shop ready to help you find what you need.'}</p><div className="mt-5 flex items-start gap-2 text-sm"><MapPin size={17} className="mt-0.5 text-primary"/><span>{shop.address}<br/><b>{shop.pinCode}</b></span></div><p className="mt-4 text-sm text-muted-foreground">Run by {shop.ownerName}</p><div className="mt-6 flex flex-wrap gap-2"><Button onClick={()=>startChat(shop.id)}><MessageCircle size={16}/> Message shop</Button><a className="btn btn-secondary" href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> WhatsApp</a><Button kind="outline" onClick={()=>setReportOpen(!reportOpen)}>Report listing</Button></div></div></div></section>
    {reportOpen&&<form onSubmit={submitReport} className="surface mt-4 grid gap-3 p-5"><div className="flex items-center justify-between"><strong>Report this shop</strong><button type="button" aria-label="Close report" onClick={()=>setReportOpen(false)}><X size={17}/></button></div><Field label="What’s the issue?" value={subject} onChange={e=>setSubject(e.target.value)} required minLength={2}/><TextArea label="Tell us a little more" value={details} onChange={e=>setDetails(e.target.value)} required minLength={10}/><Button type="submit" disabled={report.isPending}>{report.isPending?'Sending…':'Send report'}</Button></form>}
    <div className="mt-9"><PageTitle title="From this shop" note="Availability can change. Message the owner to check before you visit."/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>{!products.length&&<Empty title="Nothing listed yet" detail="This shop hasn’t added products yet. Message them to ask what’s available."/ >}</div>
  </Shell>;
}
function ProductDetail() {
  const {productId}=useParams(); const query=useGetProduct(Number(productId)); const startChat=useStartChat(); const [reportOpen,setReportOpen]=useState(false); const [subject,setSubject]=useState(''); const [details,setDetails]=useState(''); const complaint=useSubmitComplaint();
  if(query.isLoading)return <Shell><Loading/></Shell>; if(query.isError||!query.data)return <Shell><ErrorState onRetry={()=>void query.refetch()}/></Shell>;
  const {product,shop}=query.data;
  const report=(e:FormEvent)=>{e.preventDefault();complaint.mutate({data:{productId:product.id,shopId:shop.id,subject,details}},{onSuccess:()=>setReportOpen(false)})};
  return <Shell><Link href="/products" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft size={15}/> Back to products</Link><section className="surface grid overflow-hidden md:grid-cols-[.95fr_1.05fr]"><div className="min-h-[270px] bg-[#eeedff] md:min-h-[440px]">{product.imageUrl?<img src={imageSrc(product.imageUrl)??undefined} alt={product.name} className="h-full w-full object-cover"/>:<div className="grid h-full min-h-[270px] place-items-center text-[#6457c5]"><Package size={78}/></div>}</div><div className="p-6 md:p-10"><div className="micro-label">{product.category} · PIN {product.pinCode}</div><h1 className="mt-2 font-display text-3xl font-extrabold md:text-4xl">{product.name}</h1><div className="mt-3 text-2xl font-extrabold text-primary">₹{product.price.toLocaleString('en-IN')}</div><p className="mt-5 leading-7 text-muted-foreground">{product.description||'Ask the shop owner for more details about this item.'}</p><div className="mt-5 rounded-2xl bg-muted/70 p-4"><div className="micro-label">Available from</div><Link className="mt-1 inline-flex items-center gap-2 font-bold" href={`/shops/${shop.id}`}><Store size={16} className="text-primary"/>{shop.name}<ChevronRight size={15}/></Link><p className="mt-1 text-xs text-muted-foreground">{shop.address} · {shop.pinCode}</p></div><div className="mt-6 flex flex-wrap gap-2"><Button onClick={()=>startChat(shop.id,product.id)}><MessageCircle size={16}/> Ask the shop</Button><a className="btn btn-secondary" href={`https://wa.me/${shop.whatsappNumber.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/> WhatsApp</a><Button kind="outline" onClick={()=>setReportOpen(!reportOpen)}>Report</Button></div>{reportOpen&&<form onSubmit={report} className="mt-4 grid gap-3"><Field label="Issue" value={subject} onChange={e=>setSubject(e.target.value)} required minLength={2}/><TextArea label="Details" value={details} onChange={e=>setDetails(e.target.value)} required minLength={10}/><Button type="submit" disabled={complaint.isPending}>Send report</Button></form>}</div></section></Shell>;
}
function Messages() {
  const params=useParams(); const id=params.conversationId?Number(params.conversationId):0; const list=useListConversations(); const active=list.data?.find(c=>c.id===id); const messages=useListMessages(id,{query:{enabled:!!id,queryKey:getListMessagesQueryKey(id)}}); const send=useSendMessage(); const [body,setBody]=useState(''); const user=useGetCurrentUser();
  const submit=(e:FormEvent)=>{e.preventDefault();if(!body.trim())return;send.mutate({conversationId:id,data:{body:body.trim()}},{onSuccess:()=>{setBody('');void queryClient.invalidateQueries({queryKey:getListMessagesQueryKey(id)});void queryClient.invalidateQueries({queryKey:getListConversationsQueryKey()});}})};
  return <Shell><PageTitle kicker="In your loop" title="Messages" note="A direct line to the people behind the local shops."/><div className="surface grid min-h-[540px] overflow-hidden md:grid-cols-[320px_1fr]"><aside className={cx('border-r border-border',id?'hidden md:block':false)}><div className="border-b border-border px-5 py-4"><span className="micro-label">Your conversations</span></div>{list.isLoading?<div className="p-4"><Loading/></div>:list.isError?<ErrorState onRetry={()=>void list.refetch()}/>:!list.data?.length?<div className="p-5"><Empty title="No conversations yet" detail="When you find something interesting, message the shop owner directly."/></div>:list.data.map(c=><Link key={c.id} href={`/messages/${c.id}`} data-testid={`conversation-${c.id}`} className={cx('block border-b border-border px-5 py-4 hover:bg-muted/50',id===c.id&&'bg-accent')}><div className="flex justify-between gap-2"><b className="truncate text-sm">{c.shopName}</b>{c.unreadCount>0&&<span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{c.unreadCount}</span>}</div>{c.productName&&<div className="mt-1 text-[11px] font-semibold text-primary">{c.productName}</div>}<p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{c.lastMessage||'Start the conversation'}</p></Link>)}</aside><section className={cx('flex min-h-[540px] flex-col',!id&&'hidden md:flex')}><div className="flex items-center gap-2 border-b border-border px-5 py-4">{id&&<Link href="/messages" className="md:hidden"><ArrowLeft size={18}/></Link>}<div><b className="text-sm">{active?.shopName||'Choose a conversation'}</b>{active?.productName&&<div className="text-xs text-muted-foreground">About {active.productName}</div>}</div></div>{!id?<div className="grid flex-1 place-items-center"><Empty title="Pick a conversation" detail="Your conversations with local shops will appear here."/></div>:messages.isLoading?<div className="p-5"><Loading label="Loading messages"/></div>:messages.isError?<div className="p-5"><ErrorState onRetry={()=>void messages.refetch()}/></div>:<><div className="flex-1 space-y-3 overflow-y-auto p-5">{!messages.data?.length?<div className="grid h-full place-items-center"><Empty title="Say hello" detail="Ask about an item, opening hours, or anything else you need to know."/></div>:messages.data.map(m=>{const mine=m.senderId===user.data?.id;return <div key={m.id} className={cx('flex',mine?'justify-end':'justify-start')}><div className={cx('max-w-[82%] rounded-2xl px-4 py-3 text-sm',mine?'rounded-br-md bg-primary text-white':'rounded-bl-md bg-muted')}><p>{m.body}</p><span className={cx('mt-1 block text-[10px]',mine?'text-white/70':'text-muted-foreground')}>{m.senderName} · {new Date(m.createdAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div></div>})}</div><form onSubmit={submit} className="flex gap-2 border-t border-border p-3"><input className="field" aria-label="Write a message" data-testid="input-message" value={body} maxLength={2000} onChange={e=>setBody(e.target.value)} placeholder="Write a message…"/><Button type="submit" disabled={!body.trim()||send.isPending} className="px-4"><Send size={16}/><span className="sr-only">Send</span></Button></form></>}</section></div></Shell>;
}
function Notifications() {
  const q=useListNotifications(); const read=useMarkNotificationRead();
  return <Shell><PageTitle kicker="Updates" title="Notifications" note="Useful notes about your NearLoop account and local shops."/>
    {q.isLoading?<Loading/>:q.isError?<ErrorState onRetry={()=>void q.refetch()}/>:!q.data?.length?<Empty title="All quiet around here" detail="When there’s news about your account, it will show up here."/>:<div className="space-y-3">{q.data.map(n=><article key={n.id} className={cx('surface flex gap-4 p-5',!n.readAt&&'border-l-4 border-l-primary')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Bell size={18}/></span><div className="flex-1"><div className="flex flex-wrap justify-between gap-2"><b>{n.title}</b><span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</span></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{n.body}</p></div>{!n.readAt&&<Button kind="outline" className="min-h-9 px-3 text-xs" disabled={read.isPending} onClick={()=>read.mutate({notificationId:n.id},{onSuccess:()=>void queryClient.invalidateQueries({queryKey:getListNotificationsQueryKey()})})}>Mark read</Button>}</article>)}</div>}
  </Shell>;
}
function Profile() {
  const q=useGetCurrentUser(); const update=useUpdateCurrentUser(); const {signOut}=useClerk(); const [name,setName]=useState(''); const [phone,setPhone]=useState(''); const [pin,setPin]=useState('');
  useEffect(()=>{if(q.data){setName(q.data.name);setPhone(q.data.phone||'');setPin(q.data.pinCode||'')}},[q.data]);
  const submit=(e:FormEvent)=>{e.preventDefault();update.mutate({data:{name,phone:phone||null,pinCode:pin||null}},{onSuccess:()=>{void queryClient.invalidateQueries({queryKey:getGetCurrentUserQueryKey()});if(pin.length===6)window.localStorage.setItem('nearloop.pin',pin);else window.localStorage.removeItem('nearloop.pin');window.dispatchEvent(new Event('nearloop-pin-change'))}})};
  if(q.isLoading)return <Shell><Loading/></Shell>; if(q.isError||!q.data)return <Shell><ErrorState onRetry={()=>void q.refetch()}/></Shell>;
  return <Shell><PageTitle kicker="Your account" title="Profile" note="Keep your contact details and neighborhood up to date."/><div className="grid gap-5 md:grid-cols-[1fr_300px]"><form onSubmit={submit} className="surface grid gap-4 p-6"><Field label="Name" value={name} onChange={e=>setName(e.target.value)} required minLength={1}/><Field label="Email" value={q.data.email} readOnly/><Field label="Phone" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={16}/><Field label="Your PIN code" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" maxLength={6} placeholder="Six digits"/><Button type="submit" disabled={update.isPending||!name.trim()||!!pin&&pin.length!==6}>{update.isPending?'Saving…':'Save profile'}</Button>{update.isSuccess&&<p className="text-sm font-semibold text-emerald-700">Profile updated.</p>}{update.isError&&<p className="text-sm text-red-700">Couldn’t save changes. Please try again.</p>}</form><aside className="space-y-3"><div className="surface p-5"><div className="micro-label">Account type</div><p className="mt-2 font-display text-lg font-bold capitalize">{q.data.role}</p><p className="mt-1 text-xs text-muted-foreground">Your NearLoop account is linked to {q.data.email}.</p></div><Link href="/notifications" className="surface flex items-center justify-between p-4 font-semibold"><span className="flex items-center gap-2"><Bell size={17} className="text-primary"/>Notifications</span><ChevronRight size={17}/></Link>{q.data.role==='seller'&&<Link href="/seller/dashboard" className="surface flex items-center justify-between p-4 font-semibold"><span className="flex items-center gap-2"><Store size={17} className="text-primary"/>Seller dashboard</span><ChevronRight size={17}/></Link>}{q.data.role==='admin'&&<Link href="/admin/moderation" className="surface flex items-center justify-between p-4 font-semibold"><span className="flex items-center gap-2"><ShieldCheck size={17} className="text-primary"/>Admin workspace</span><ChevronRight size={17}/></Link>}<Button kind="outline" className="w-full" onClick={()=>signOut({redirectUrl:basePath||'/'})}>Sign out</Button></aside></div></Shell>;
}
function Help() {
  const [open,setOpen]=useState(0); const faqs=[['Why do I need a PIN code?','NearLoop is built around your exact neighborhood. Your six-digit PIN helps us show verified shops and products that are actually local to you.'],['Can I buy products on NearLoop?','NearLoop helps you discover local products and contact the shop owner. There is no checkout, delivery, or order management on the platform.'],['How do I contact a shop?','Use the in-app message button or open WhatsApp from a shop or product page. The shop owner can answer questions about availability.'],['How can I list my shop?','Sign in, choose “List your shop”, and send an application. Once reviewed, approved sellers can manage their public listings.'],['What does Premium mean?','Premium is an optional shop subscription that gives eligible shops featured placement. Test payments are clearly marked as simulations.']];
  const health=useHealthCheck();
  return <Shell><PageTitle kicker="A few quick answers" title="How NearLoop works" note="A neighborhood marketplace, made for finding nearby people—not adding another checkout flow."/><div className="grid gap-6 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-[24px] bg-[#252d48] p-6 text-white"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Compass size={20}/></span><h2 className="mt-5 font-display text-2xl font-extrabold">Local discovery.<br/>Human conversations.</h2><p className="mt-3 text-sm leading-6 text-[#c3c7df]">NearLoop connects neighborhood customers with verified independent shops. Browse what's listed, then talk directly to the owner.</p><Link href="/shops" className="btn mt-6 bg-white text-[#252d48]">Explore shops <ArrowRight size={16}/></Link><div className="mt-6 flex items-center gap-2 border-t border-white/15 pt-4 text-xs text-[#c3c7df]" data-testid="status-service-health"><span className={cx('h-2 w-2 rounded-full',health.isError?'bg-red-300':health.data?'bg-emerald-300':'bg-amber-300')}/>{health.isLoading?'Checking service status…':health.isError?'Service status unavailable':`Marketplace service: ${health.data?.status||'available'}`}</div></div><div className="space-y-2">{faqs.map(([q,a],i)=><button key={q} className="surface block w-full p-5 text-left" onClick={()=>setOpen(open===i?-1:i)}><span className="flex items-center justify-between gap-3 font-bold">{q}<ChevronDown size={17} className={cx('transition-transform',open===i&&'rotate-180')}/></span>{open===i&&<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{a}</p>}</button>)}</div></div></Shell>;
}
function SellerApplication() {
  const status=useGetSellerShopStatus(); const submit=useSubmitShopApplication(); const resend=useResubmitShopApplication(); const cats=useListCategories();
  const blank={name:'',ownerName:'',category:'',address:'',pinCode:'',contactPhone:'',whatsappNumber:''}; const [form,setForm]=useState(blank);
  const change=(key:keyof typeof blank)=>(e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setForm({...form,[key]:key==='pinCode'?e.target.value.replace(/\D/g,'').slice(0,6):e.target.value});
  const onSubmit=(e:FormEvent)=>{e.preventDefault();const op=status.data?.application?resend:submit;op.mutate({data:form},{onSuccess:()=>{void queryClient.invalidateQueries({queryKey:getGetSellerShopStatusQueryKey()});}})};
  if(status.isLoading)return <Shell><Loading/></Shell>;if(status.isError)return <Shell><ErrorState onRetry={()=>void status.refetch()}/></Shell>;
  const app=status.data?.application; const shop=status.data?.shop;
  if(shop)return <Shell><PageTitle kicker="Seller application" title={shop.name} note="Your shop is approved and ready for its NearLoop seller workspace." action={<Link href="/seller/dashboard" className="btn btn-primary">Open dashboard <ArrowRight size={15}/></Link>}/><StatusCard status="approved" title="You’re in the loop" detail={`Your shop serves ${shop.pinCode}. Manage products and Premium from the seller workspace.`}/></Shell>;
  if(app&&app.status!=='rejected')return <Shell><PageTitle kicker="Seller application" title="Application status" note="We’ll keep you posted as your shop is reviewed."/><StatusCard status={app.status} title={app.status==='pending'?'Your application is with our team':app.status==='suspended'?'Your shop needs attention':'Application update'} detail={app.rejectionReason||`Submitted ${new Date(app.createdAt).toLocaleDateString()}. We’re reviewing your details.`}/><div className="mt-4 surface p-5"><b>{app.name}</b><p className="mt-1 text-sm text-muted-foreground">{app.category} · PIN {app.pinCode}</p></div></Shell>;
  return <Shell><PageTitle kicker="For independent shops" title={app?'Make those changes and resubmit':'Put your shop on the local map'} note="Tell us who you are and where you serve. We’ll review your details before the shop appears to customers."/><form onSubmit={onSubmit} className="surface grid gap-4 p-5 sm:grid-cols-2 md:p-7"><Field label="Shop name" required minLength={2} value={form.name} onChange={change('name')}/><Field label="Owner name" required minLength={2} value={form.ownerName} onChange={change('ownerName')}/><label className="block space-y-1.5"><span className="text-sm font-semibold">Category</span><select className="field" value={form.category} onChange={change('category')} required><option value="">Choose a category</option>{(cats.data||[]).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><Field label="Service PIN code" placeholder="6 digits" inputMode="numeric" maxLength={6} required value={form.pinCode} onChange={change('pinCode')}/><label className="block space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold">Shop address</span><textarea className="field min-h-20" minLength={5} required value={form.address} onChange={change('address')}/></label><Field label="Contact phone" required minLength={10} maxLength={16} value={form.contactPhone} onChange={change('contactPhone')}/><Field label="WhatsApp number" required minLength={10} maxLength={16} value={form.whatsappNumber} onChange={change('whatsappNumber')}/><div className="flex items-center justify-between gap-4 border-t border-border pt-4 sm:col-span-2"><p className="text-xs leading-5 text-muted-foreground">Your application is reviewed before your shop becomes visible. No listing fee to apply.</p><Button type="submit" disabled={submit.isPending||resend.isPending||form.pinCode.length!==6}>{submit.isPending||resend.isPending?'Sending…':app?'Resubmit application':'Send application'} <ArrowRight size={15}/></Button></div>{(submit.isError||resend.isError)&&<p className="text-sm text-red-700 sm:col-span-2">We couldn’t submit this application. Check your details and try again.</p>}</form></Shell>;
}
function StatusCard({status,title,detail}:{status:string;title:string;detail:string}) { return <div className="surface flex gap-4 p-6"><div className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl',status==='approved'?'bg-emerald-50 text-emerald-700':status==='rejected'||status==='suspended'?'bg-red-50 text-red-700':'bg-[#fff4dd] text-[#936813]')}>{status==='approved'?<Check size={23}/>:status==='pending'?<Clock3 size={23}/>:<LifeBuoy size={23}/>}</div><div><div className="micro-label">{status}</div><h2 className="mt-1 font-display text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div></div>; }
function SellerShell({children,requireApproved=true}:{children:ReactNode;requireApproved?:boolean}) {
  const links=[['/seller/dashboard','Overview',LayoutDashboard],['/seller/products','Products',Package],['/seller/analysis','Insights',TrendingUp],['/seller/premium','Premium',Crown],['/seller/status','Application',BadgeCheck]] as const;
  const status=useGetSellerShopStatus();
  const allowed=!requireApproved||Boolean(status.data?.shop);
  return <Shell>{!requireApproved||allowed?<><div className="mb-6 flex gap-2 overflow-x-auto pb-1">{links.map(([href,label,Icon])=><Link key={href} href={href} className="btn btn-outline min-h-10 whitespace-nowrap px-3 text-xs"><Icon size={15}/>{label}</Link>)}</div>{children}</>:status.isLoading?<Loading label="Checking seller permissions"/>:status.isError?<ErrorState onRetry={()=>void status.refetch()}/>:<><PageTitle kicker="Seller studio" title="Your shop is not approved yet" note="Product and Premium tools open once your shop has been approved."/><StatusCard status={status.data?.application?.status||'pending'} title={status.data?.application?.status==='rejected'?'Update your application':'Application in progress'} detail={status.data?.application?.rejectionReason||'We’ll unlock seller tools once the shop review is complete.'}/><Link href="/seller/application" className="btn btn-primary mt-5">View application status <ArrowRight size={15}/></Link></>}</Shell>;
}
function SellerDashboard() {
  const q=useGetSellerOverview(); const stat=useGetSellerShopStatus();
  if(q.isLoading)return <SellerShell><Loading/></SellerShell>; if(q.isError||!q.data)return <SellerShell><ErrorState onRetry={()=>void q.refetch()}/></SellerShell>;
  const {shop}=q.data;
  const metrics=[['Listings',q.data.totalProducts,Package],['Available',q.data.availableProducts,Check],['Inquiries',q.data.inquiries,MessageCircle],['Profile views',q.data.profileViews,Eye]] as const;
  return <SellerShell>
    <PageTitle kicker="Seller studio" title={`Good to see you, ${shop.ownerName.split(' ')[0]}`} note={`Here’s a quick read on ${shop.name}. Your shop is visible to customers in ${shop.pinCode}.`} action={<Link href="/seller/products" className="btn btn-primary"><Plus size={16}/> Add a product</Link>}/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label,value,Icon])=><div key={label} className="surface p-5"><div className="flex items-center justify-between"><span className="micro-label">{label}</span><Icon size={18} className="text-primary"/></div><div className="mt-4 font-display text-3xl font-extrabold">{value}</div></div>)}</div>
    <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
      <div className="surface p-6"><div className="flex items-center justify-between"><div><div className="micro-label">Shop visibility</div><h2 className="mt-1 font-display text-xl font-bold">{shop.name}</h2></div><span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><BadgeCheck size={14}/> Verified</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Your listing is visible to people searching the exact PIN code {shop.pinCode}. Keep products fresh and respond to inquiries promptly.</p><Link href={`/shops/${shop.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">View public shop <ArrowRight size={15}/></Link></div>
      <div className="rounded-[20px] bg-[#252d48] p-6 text-white"><div className="flex items-center gap-2 text-[#f2cb76]"><Crown size={18}/><span className="micro-label text-[#d5c9a8]">NearLoop Premium</span></div><h3 className="mt-3 font-display text-xl font-bold">{q.data.subscriptionStatus==='active'?'You’re getting noticed':'A little more neighborhood reach'}</h3><p className="mt-2 text-sm leading-6 text-[#c3c7df]">{q.data.subscriptionStatus==='active'?`Active until ${q.data.expiresAt?new Date(q.data.expiresAt).toLocaleDateString():'your subscription ends'}.`:'Feature your shop and give nearby customers one more reason to stop by.'}</p><Link href="/seller/premium" className="btn mt-4 min-h-10 bg-white text-[#252d48]">{q.data.subscriptionStatus==='active'?'Manage Premium':'Explore Premium'} <ArrowRight size={14}/></Link></div>
    </div>
    {stat.data?.application?.status==='rejected'&&<div className="mt-4"><StatusCard status="rejected" title="Application needs an update" detail={stat.data.application.rejectionReason||'Please review your application details and resubmit.'}/></div>}
  </SellerShell>;
}
function ProductEditor({product,onClose}:{product?:Product|null;onClose:()=>void}) {
  const create=useCreateSellerProduct(); const update=useUpdateSellerProduct(); const cats=useListCategories();
  const [form,setForm]=useState({name:product?.name||'',category:product?.category||'',description:product?.description||'',price:product?.price?.toString()||'',imageUrl:product?.imageUrl||'',available:product?.available??true,isFeatured:product?.isFeatured??false});
  const [uploading,setUploading]=useState(false); const [uploadError,setUploadError]=useState('');
  const uploadPhoto=async(file:File)=>{
    const allowed=['image/jpeg','image/png','image/webp','image/avif'];
    if(!allowed.includes(file.type)||file.size<1||file.size>5*1024*1024){setUploadError('Choose a JPEG, PNG, WebP, or AVIF image up to 5 MB.');return;}
    setUploading(true);setUploadError('');
    try{
      const request=await fetch(`${basePath}/api/storage/uploads/request-url`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:file.name,size:file.size,contentType:file.type})});
      const details=await request.json().catch(()=>({})) as {uploadURL?:string;objectPath?:string;message?:string};
      if(!request.ok||!details.uploadURL||!details.objectPath)throw new Error(details.message||'Could not prepare the photo upload. Check seller approval and try again.');
      const upload=await fetch(details.uploadURL,{method:'PUT',headers:{'Content-Type':file.type},body:file});
      if(!upload.ok)throw new Error('Photo upload did not complete. Please try again.');
      const relative=details.objectPath.replace(/^\/objects\//,'');
      setForm(current=>({...current,imageUrl:`/api/storage/objects/${relative}`}));
    }catch(error){setUploadError(error instanceof Error?error.message:'Photo upload failed.');}
    finally{setUploading(false);}
  };
  const submit=(e:FormEvent)=>{e.preventDefault();const data={...form,price:Number(form.price),description:form.description||null,imageUrl:form.imageUrl||null};const done=()=>{void queryClient.invalidateQueries({queryKey:getListSellerProductsQueryKey()});void queryClient.invalidateQueries({queryKey:getGetSellerOverviewQueryKey()});onClose()};if(product)update.mutate({productId:product.id,data},{onSuccess:done});else create.mutate({data},{onSuccess:done});};
  return <form onSubmit={submit} className="surface grid gap-3 p-5 sm:grid-cols-2">
    <div className="flex items-center justify-between sm:col-span-2"><b>{product?'Edit listing':'Add a product'}</b><button type="button" aria-label="Close product form" onClick={onClose}><X size={18}/></button></div>
    <Field label="Product name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required minLength={2}/>
    <label className="block space-y-1.5"><span className="text-sm font-semibold">Category</span><select required className="field" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">Choose</option>{(cats.data||[]).map(c=><option value={c.name} key={c.id}>{c.name}</option>)}</select></label>
    <Field label="Price in rupees" type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/>
    <Field label="HTTPS image URL (optional)" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})}/>
    <div className="sm:col-span-2 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        {form.imageUrl&&<Photo src={form.imageUrl} name={form.name||'Product'} shape="h-12 w-12 rounded-xl"/>}
        <label className={cx('btn btn-outline min-h-10 cursor-pointer px-3 text-xs',uploading&&'pointer-events-none opacity-60')}><Upload size={15}/>{uploading?'Uploading photo…':'Choose a product photo'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void uploadPhoto(file);}}/></label>
        <span className="text-xs text-muted-foreground">JPEG, PNG, WebP or AVIF · up to 5 MB</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Uploaded photos remain private until you save the product listing.</p>
      {uploadError&&<p role="alert" className="mt-2 text-sm text-red-700">{uploadError}</p>}
    </div>
    <label className="block space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold">Description</span><textarea className="field min-h-20" maxLength={2000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.available} onChange={e=>setForm({...form,available:e.target.checked})}/> Available</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={e=>setForm({...form,isFeatured:e.target.checked})}/> Feature this product</label>
    <Button type="submit" className="sm:col-span-2" disabled={uploading||create.isPending||update.isPending}>{uploading?'Finishing photo…':create.isPending||update.isPending?'Saving…':product?'Save changes':'Add listing'}</Button>
  </form>;
}
function SellerProducts() {
  const q=useListSellerProducts();const del=useDeleteSellerProduct();const [editing,setEditing]=useState<Product|null|undefined>(undefined);
  return <SellerShell><PageTitle kicker="Your catalogue" title="Products" note="Listings are shown only to customers browsing your shop’s exact PIN code." action={<Button onClick={()=>setEditing(null)}><Plus size={16}/> Add product</Button>}/>{editing!==undefined&&<div className="mb-4"><ProductEditor product={editing} onClose={()=>setEditing(undefined)}/></div>}{q.isLoading?<Loading/>:q.isError?<ErrorState onRetry={()=>void q.refetch()}/>:!q.data?.length?<Empty title="Your shelf is waiting" detail="Add your first product so nearby customers know what your shop has in store." action={<Button onClick={()=>setEditing(null)}><Plus size={15}/> Add first product</Button>}/>:<div className="space-y-3">{q.data.map(p=><article key={p.id} className="surface flex flex-wrap items-center gap-4 p-4"><Photo src={p.imageUrl} name={p.name} shape="h-16 w-16 rounded-xl"/><div className="min-w-0 flex-1"><div className="micro-label">{p.category}</div><b className="block truncate">{p.name}</b><span className="text-sm text-primary">₹{p.price.toLocaleString('en-IN')}</span><span className={cx('ml-2 text-xs',p.available?'text-emerald-700':'text-muted-foreground')}>· {p.available?'Available':'Unavailable'}</span></div><Button kind="outline" className="min-h-9 px-3 text-xs" onClick={()=>setEditing(p)}>Edit</Button><Button kind="danger" className="min-h-9 px-3 text-xs" onClick={()=>{if(window.confirm(`Remove “${p.name}” from your listings?`))del.mutate({productId:p.id},{onSuccess:()=>void queryClient.invalidateQueries({queryKey:getListSellerProductsQueryKey()})})}} disabled={del.isPending}><Trash2 size={14}/> Remove</Button></article>)}</div>}</SellerShell>;
}
function SellerAnalysis() {
  const q=useGetSellerOverview();
  if(q.isLoading)return <SellerShell><Loading/></SellerShell>;if(q.isError||!q.data)return <SellerShell><ErrorState onRetry={()=>void q.refetch()}/></SellerShell>;
  const metrics=[['Profile views',q.data.profileViews,Eye],['Shop inquiries',q.data.inquiries,MessageCircle],['Products available',q.data.availableProducts,Package]] as const;
  return <SellerShell><PageTitle kicker="Shop signals" title="A look at your reach" note="Understand how customers are finding and contacting your shop."/><div className="surface p-6 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="micro-label">Your storefront</div><h2 className="mt-1 font-display text-2xl font-extrabold">{q.data.shop.name}</h2></div><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">PIN {q.data.shop.pinCode}</span></div><div className="mt-7 grid gap-4 md:grid-cols-3">{metrics.map(([label,value,Icon])=><div key={String(label)} className="rounded-2xl bg-muted/65 p-5"><Icon size={19} className="text-primary"/><div className="mt-4 font-display text-3xl font-extrabold">{value as number}</div><div className="mt-1 text-sm text-muted-foreground">{label as string}</div></div>)}</div><p className="mt-6 text-xs leading-5 text-muted-foreground">These figures reflect activity available to your seller account. Keep your profile and product availability up to date for a useful local listing.</p></div></SellerShell>;
}
function SellerPremium() {
  const q=useGetMySubscription();const start=useStartSubscription();const pay=useCompleteTestPayment();const status=useGetSellerOverview();
  const [testToken,setTestToken]=useState<string|null>(null);
  const subscription=q.data?.subscription;
  const startNow=()=>start.mutate({data:{shopId:status.data!.shop.id}},{onSuccess:(result)=>{setTestToken(result.testToken);void queryClient.invalidateQueries({queryKey:getGetMySubscriptionQueryKey()})}});
  const payNow=(outcome:'success'|'decline')=>{const s=q.data?.subscription;if(s&&testToken)pay.mutate({subscriptionId:s.id,data:{testToken,outcome}},{onSuccess:()=>{setTestToken(null);void queryClient.invalidateQueries({queryKey:getGetMySubscriptionQueryKey()});void queryClient.invalidateQueries({queryKey:getGetSellerOverviewQueryKey()})}})};
  if(q.isLoading||status.isLoading)return <SellerShell><Loading/></SellerShell>;if(q.isError||status.isError||!q.data||!status.data)return <SellerShell><ErrorState onRetry={()=>{void q.refetch();void status.refetch()}}/></SellerShell>;
  return <SellerShell><PageTitle kicker="Optional shop subscription" title="NearLoop Premium" note="A little more visibility for a shop that’s already part of the neighborhood."/><div className="grid gap-5 md:grid-cols-[1fr_340px]"><div className="rounded-[24px] bg-[#252d48] p-7 text-white md:p-9"><div className="flex items-center gap-2 text-[#f2cb76]"><Crown size={20}/><span className="micro-label text-[#d5c9a8]">For {status.data.shop.name}</span></div><h2 className="mt-4 font-display text-3xl font-extrabold">Show up a little brighter.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#c3c7df]">Premium can feature your shop for customers exploring your exact PIN code. Customers still contact you directly—there is no checkout or delivery layer.</p><ul className="mt-6 space-y-3 text-sm"><li className="flex gap-2"><Check size={16} className="text-[#f2cb76]"/> Featured placement in nearby discovery</li><li className="flex gap-2"><Check size={16} className="text-[#f2cb76]"/> Keep control of every customer conversation</li><li className="flex gap-2"><Check size={16} className="text-[#f2cb76]"/> Subscription state visible in your seller studio</li></ul></div><aside className="surface p-6"><div className="micro-label">Subscription</div>{subscription?<><div className="mt-2 flex items-center justify-between"><h3 className="font-display text-xl font-bold capitalize">{subscription.status}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">₹{subscription.amountInr.toLocaleString('en-IN')}</span></div><p className="mt-3 text-sm text-muted-foreground">{subscription.expiresAt?`${subscription.status==='active'?'Expires':'Expired'} ${new Date(subscription.expiresAt).toLocaleDateString()}`:'Your subscription is being prepared.'}</p>{subscription.status==='pending'&&q.data.testMode&&<div className="mt-5 rounded-xl border border-[#ead7a2] bg-[#fff9e9] p-4"><b className="text-sm text-[#705522]">Test mode simulation</b><p className="mt-1 text-xs leading-5 text-[#7b6945]">This is a simulated test payment only. No real funds will move.</p>{testToken?<div className="mt-3 grid gap-2"><Button className="w-full" disabled={pay.isPending} onClick={()=>payNow('success')}>{pay.isPending?'Processing simulation…':'Simulate successful payment'}</Button><Button kind="outline" className="w-full" disabled={pay.isPending} onClick={()=>payNow('decline')}>Simulate declined payment</Button></div>:<Button className="mt-3 w-full" disabled={start.isPending} onClick={startNow}>{start.isPending?'Resuming…':'Resume test payment'}</Button>}</div>}</>:null}{(!subscription||subscription.status==='expired'||subscription.status==='cancelled')&&<><div className="mt-3 font-display text-3xl font-extrabold">₹{q.data.monthlyPriceInr.toLocaleString('en-IN')}<span className="ml-1 text-sm font-semibold text-muted-foreground">/ month</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{subscription?.status==='expired'?'Your listing is no longer visible. Renew to restore Premium visibility.':'Optional membership; renew or activate to feature your approved shop.'}</p><Button className="mt-5 w-full" disabled={start.isPending} onClick={startNow}>{start.isPending?'Preparing…':subscription?'Renew Premium':'Start Premium'}</Button></>}{!q.data.testMode&&subscription?.status==='pending'&&<p className="mt-4 text-xs text-muted-foreground">Payment is awaiting verified provider confirmation. No real payment provider is configured for this environment.</p>}{(start.isError||pay.isError)&&<p className="mt-3 text-sm text-red-700">We couldn’t complete that step. Try again or contact support.</p>}</aside></div>{q.data.payments.length>0&&<section className="mt-7"><h3 className="mb-3 font-display text-xl font-bold">Payment history</h3><div className="surface divide-y divide-border">{q.data.payments.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><b>₹{p.amountInr.toLocaleString('en-IN')}</b><p className="mt-1 text-xs text-muted-foreground">{p.provider} · {new Date(p.createdAt).toLocaleDateString()}</p></div><span className={cx('rounded-full px-2.5 py-1 text-xs font-bold',p.status==='verified'?'bg-emerald-50 text-emerald-700':p.status==='failed'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700')}>{p.status}</span></div>)}</div></section>}</SellerShell>;
}
function SellerStatus() { const q=useGetSellerShopStatus();if(q.isLoading)return <SellerShell requireApproved={false}><Loading/></SellerShell>;if(q.isError)return <SellerShell requireApproved={false}><ErrorState onRetry={()=>void q.refetch()}/></SellerShell>;const app=q.data?.application;const shop=q.data?.shop;return <SellerShell requireApproved={false}><PageTitle kicker="Application" title="Shop status" note="Your seller access follows the review status of your shop."/>{shop?<StatusCard status="approved" title={`${shop.name} is approved`} detail={`Your shop can list products in PIN ${shop.pinCode}.`}/>:app?<StatusCard status={app.status} title={app.status==='pending'?'Under review':app.status==='rejected'?'Updates requested':'Shop status'} detail={app.rejectionReason||`Application submitted on ${new Date(app.createdAt).toLocaleDateString()}.`}/>:<Empty title="No application yet" detail="Start by telling us about your shop. Once reviewed, approved sellers can manage their products." action={<Link href="/seller/apply" className="btn btn-primary">Apply to list your shop</Link>}/>}</SellerShell>; }

function SignInPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10"><div className="w-full max-w-[440px]"><Link href="/" className="mb-5 flex items-center justify-center gap-2 font-display text-lg font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white"><MapPin size={18}/></span>nearloop</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/><p className="mt-5 text-center text-xs text-muted-foreground">A local marketplace for real neighborhood connections.</p></div></div>;
}
function SignUpPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-10"><div className="w-full max-w-[440px]"><Link href="/" className="mb-5 flex items-center justify-center gap-2 font-display text-lg font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white"><MapPin size={18}/></span>nearloop</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/><p className="mt-5 text-center text-xs text-muted-foreground">A local marketplace for real neighborhood connections.</p></div></div>;
}
function AdminPage({section}:{section:string}) {
  return <Guard role="admin"><AdminWorkspace section={section}/></Guard>;
}
function ClerkRoutes() {
  const [,setLocation]=useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn:{start:{title:'Welcome back',subtitle:'Sign in to find your neighborhood.'}},
      signUp:{start:{title:'Join your neighborhood',subtitle:'Create a NearLoop account.'}},
    }}
    routerPush={to=>setLocation(stripBase(to))}
    routerReplace={to=>setLocation(stripBase(to),{replace:true})}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator/>
      <Switch>
        <Route path="/" component={Home}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/shops" component={()=> <SearchPage kind="shops"/>}/>
        <Route path="/products" component={()=> <SearchPage kind="products"/>}/>
        <Route path="/shops/:shopId" component={ShopDetail}/>
        <Route path="/products/:productId" component={ProductDetail}/>
        <Route path="/messages" component={()=> <Guard><Messages/></Guard>}/>
        <Route path="/messages/:conversationId" component={()=> <Guard><Messages/></Guard>}/>
        <Route path="/notifications" component={()=> <Guard><Notifications/></Guard>}/>
        <Route path="/profile" component={()=> <Guard><Profile/></Guard>}/>
        <Route path="/help" component={Help}/>
        <Route path="/seller/application" component={()=> <Guard><SellerApplication/></Guard>}/>
        <Route path="/seller/apply" component={()=> <Guard><SellerApplication/></Guard>}/>
        <Route path="/seller/status" component={()=> <Guard role="seller"><SellerStatus/></Guard>}/>
        <Route path="/seller/dashboard" component={()=> <Guard role="seller"><SellerDashboard/></Guard>}/>
        <Route path="/seller/products" component={()=> <Guard role="seller"><SellerProducts/></Guard>}/>
        <Route path="/seller/analysis" component={()=> <Guard role="seller"><SellerAnalysis/></Guard>}/>
        <Route path="/seller/premium" component={()=> <Guard role="seller"><SellerPremium/></Guard>}/>
        <Route path="/admin/moderation" component={()=> <AdminPage section="moderation"/>}/>
        <Route path="/admin/shops" component={()=> <AdminPage section="shops"/>}/>
        <Route path="/admin/sellers" component={()=> <AdminPage section="sellers"/>}/>
        <Route path="/admin/products" component={()=> <AdminPage section="products"/>}/>
        <Route path="/admin/complaints" component={()=> <AdminPage section="complaints"/>}/>
        <Route path="/admin/billing" component={()=> <AdminPage section="billing"/>}/>
        <Route path="/admin/categories" component={()=> <AdminPage section="categories"/>}/>
        <Route path="/admin/pincodes" component={()=> <AdminPage section="pincodes"/>}/>
        <Route component={NotFound}/>
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}
function NotFound() {
  return <Shell><Empty title="This page isn’t on the map" detail="That address doesn’t lead to a NearLoop page. Head back to your neighborhood and try another route." action={<Link href="/" className="btn btn-primary">Back home</Link>}/></Shell>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkRoutes/></WouterRouter>;
}

export default App;
