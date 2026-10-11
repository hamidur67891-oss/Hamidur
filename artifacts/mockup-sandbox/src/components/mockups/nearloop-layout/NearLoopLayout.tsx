import { useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

export function NearLoopLayout() {
  const [pinDraft, setPinDraft] = useState("");
  const [activePin, setActivePin] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const submitPin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pinDraft.length === 6) {
      setActivePin(pinDraft);
      setNotice(`Your neighborhood is set to ${pinDraft}.`);
    } else {
      setNotice("Enter all six digits to see shops that serve your block.");
    }
  };

  return (
    <div className="nl-page">
      <style>{`
        .nl-page {
          --nl-ink: #263351;
          --nl-ink-soft: #56617a;
          --nl-muted: #777f91;
          --nl-blue: #414db2;
          --nl-blue-deep: #303d96;
          --nl-lilac: #eeedff;
          --nl-line: #e4e5eb;
          --nl-paper: #f7f7f3;
          --nl-card: #fffefa;
          --nl-coral: #eb7967;
          min-height: 100dvh;
          background: var(--nl-paper);
          color: var(--nl-ink);
          font-family: "DM Sans", "Avenir Next", system-ui, sans-serif;
          letter-spacing: -0.012em;
          -webkit-font-smoothing: antialiased;
        }
        .nl-page * { box-sizing: border-box; }
        .nl-frame { display: flex; min-height: 100dvh; }
        .nl-rail {
          position: sticky;
          top: 0;
          display: flex;
          width: 286px;
          min-width: 286px;
          min-height: 100dvh;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          padding: 31px 25px 25px;
          background: #2c3858;
          color: #fbfaf5;
        }
        .nl-rail::before {
          position: absolute;
          right: -93px;
          bottom: 186px;
          width: 240px;
          height: 240px;
          border: 1px solid rgba(225, 224, 255, .16);
          border-radius: 50%;
          content: "";
          pointer-events: none;
        }
        .nl-rail::after {
          position: absolute;
          right: -56px;
          bottom: 223px;
          width: 166px;
          height: 166px;
          border: 1px solid rgba(225, 224, 255, .16);
          border-radius: 50%;
          content: "";
          pointer-events: none;
        }
        .nl-brand { display: inline-flex; align-items: center; gap: 11px; color: inherit; text-decoration: none; }
        .nl-brand-mark {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 14px;
          background: #eeedff;
          color: var(--nl-blue);
        }
        .nl-brand-word { font-family: "Manrope", "Avenir Next", system-ui, sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -.055em; }
        .nl-brand-dot { color: #ef927e; }
        .nl-rail-note { margin: 42px 0 21px; color: #aeb7d0; font-size: 10px; font-weight: 800; letter-spacing: .17em; text-transform: uppercase; }
        .nl-rail-title { max-width: 200px; margin: 0; font-family: "Manrope", "Avenir Next", system-ui, sans-serif; font-size: 25px; font-weight: 700; line-height: 1.21; letter-spacing: -.045em; }
        .nl-nav { display: grid; gap: 7px; margin-top: 33px; }
        .nl-nav a {
          display: flex;
          min-height: 48px;
          align-items: center;
          gap: 13px;
          padding: 0 13px;
          border: 1px solid transparent;
          border-radius: 13px;
          color: #c4cadd;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          transition: background .2s, color .2s, transform .2s;
        }
        .nl-nav a:hover { transform: translateX(3px); background: rgba(255,255,255,.07); color: #fff; }
        .nl-nav a.is-current { border-color: rgba(235, 237, 255, .13); background: rgba(230, 230, 255, .1); color: #fff; }
        .nl-nav a.is-current .nl-nav-icon { color: #f5a28f; }
        .nl-nav-icon { display: grid; width: 22px; place-items: center; color: #aab4cf; }
        .nl-rail-footer { position: relative; z-index: 1; }
        .nl-rail-footer-rule { height: 1px; margin-bottom: 18px; background: rgba(235,237,255,.16); }
        .nl-rail-footer-label { display: flex; align-items: center; gap: 7px; color: #f1a18e; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
        .nl-rail-footer-copy { max-width: 208px; margin: 9px 0 0; color: #c1c8d9; font-size: 12px; line-height: 1.65; }
        .nl-main { min-width: 0; flex: 1; }
        .nl-topbar {
          display: flex;
          height: 82px;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 clamp(28px, 5vw, 82px);
          border-bottom: 1px solid rgba(221, 224, 232, .8);
          background: rgba(255, 254, 250, .57);
        }
        .nl-breadcrumb { display: flex; align-items: center; gap: 10px; color: var(--nl-muted); font-size: 12px; font-weight: 650; }
        .nl-breadcrumb-mark { width: 7px; height: 7px; border-radius: 50%; background: #ed947f; box-shadow: 0 0 0 4px #f9e8e2; }
        .nl-top-actions { display: flex; align-items: center; gap: 10px; }
        .nl-pin-status { display: flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--nl-line); border-radius: 999px; background: #fffefa; color: #697287; font-size: 11px; font-weight: 650; }
        .nl-pin-status svg { color: var(--nl-blue); }
        .nl-signin {
          display: inline-flex;
          height: 39px;
          align-items: center;
          gap: 8px;
          padding: 0 14px;
          border: 1px solid #d9dbe5;
          border-radius: 11px;
          background: transparent;
          color: var(--nl-ink);
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition: border-color .2s, background .2s, transform .2s;
        }
        .nl-signin:hover { transform: translateY(-1px); border-color: #aaaed0; background: #fffefa; }
        .nl-content { width: min(100%, 1450px); margin: 0 auto; padding: 48px clamp(28px, 5vw, 82px) 54px; }
        .nl-hero {
          position: relative;
          display: grid;
          min-height: 390px;
          grid-template-columns: minmax(0, 1.2fr) minmax(285px, .8fr);
          align-items: center;
          gap: clamp(26px, 4vw, 66px);
        }
        .nl-hero-copy { position: relative; z-index: 1; padding: 4px 0 21px; animation: nl-rise .55s cubic-bezier(.2,.7,.2,1) both; }
        .nl-eyebrow { display: flex; align-items: center; gap: 9px; color: #5b60a3; font-size: 10px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
        .nl-eyebrow-line { width: 25px; height: 1px; background: #ec8f7d; }
        .nl-headline {
          max-width: 730px;
          margin: 22px 0 0;
          font-family: "Manrope", "Avenir Next", system-ui, sans-serif;
          font-size: clamp(48px, 5.4vw, 78px);
          font-weight: 800;
          line-height: .99;
          letter-spacing: -.075em;
        }
        .nl-headline em { color: var(--nl-blue); font-style: normal; }
        .nl-hero-intro { max-width: 520px; margin: 22px 0 0; color: #70798d; font-size: 15px; line-height: 1.75; }
        .nl-hero-art {
          position: relative;
          min-height: 337px;
          overflow: hidden;
          border: 1px solid #e1e1ed;
          border-radius: 28px;
          background: #eeedff;
          box-shadow: 0 18px 45px rgba(49, 57, 106, .08);
          animation: nl-rise .65s .08s cubic-bezier(.2,.7,.2,1) both;
        }
        .nl-map-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .nl-map-tag {
          position: absolute;
          left: 19px;
          bottom: 19px;
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 206px;
          padding: 12px 14px;
          border: 1px solid rgba(255,255,255,.86);
          border-radius: 15px;
          background: rgba(255,254,250,.91);
          box-shadow: 0 8px 26px rgba(49,57,106,.09);
          backdrop-filter: blur(8px);
        }
        .nl-map-tag-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 12px; background: #f8e4df; color: #ce6859; }
        .nl-map-tag b { display: block; font-size: 11px; font-weight: 800; }
        .nl-map-tag span { display: block; margin-top: 3px; color: #858b9a; font-size: 10px; }
        .nl-map-caption { position: absolute; top: 18px; right: 19px; display: flex; align-items: center; gap: 7px; color: #747a9d; font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .nl-map-caption::before { width: 6px; height: 6px; border-radius: 50%; background: #ec8e7b; content: ""; }
        .nl-loc-row {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto;
          align-items: center;
          gap: 22px;
          margin-top: 25px;
          padding: 16px 17px 16px 21px;
          border: 1px solid #e2e3eb;
          border-radius: 20px;
          background: #fffefa;
          box-shadow: 0 13px 36px rgba(49,57,106,.065);
          animation: nl-rise .55s .13s cubic-bezier(.2,.7,.2,1) both;
        }
        .nl-loc-copy { display: flex; align-items: center; gap: 13px; min-width: 0; }
        .nl-loc-icon { display: grid; width: 44px; height: 44px; flex: 0 0 auto; place-items: center; border-radius: 14px; background: #eeedff; color: var(--nl-blue); }
        .nl-loc-copy b { display: block; font-size: 13px; font-weight: 800; }
        .nl-loc-copy span { display: block; margin-top: 4px; color: #83899a; font-size: 11px; }
        .nl-loc-form { display: flex; width: min(100%, 440px); align-items: center; gap: 8px; }
        .nl-input-wrap { display: flex; height: 48px; min-width: 0; flex: 1; align-items: center; gap: 9px; padding: 0 13px; border: 1px solid #dfe1e9; border-radius: 12px; background: #faf9f6; transition: border-color .2s, box-shadow .2s; }
        .nl-input-wrap:focus-within { border-color: #8289cb; box-shadow: 0 0 0 3px rgba(65,77,178,.1); }
        .nl-input-wrap svg { flex: 0 0 auto; color: #626bb0; }
        .nl-input-wrap input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--nl-ink); font-family: inherit; font-size: 14px; font-weight: 750; letter-spacing: .1em; }
        .nl-input-wrap input::placeholder { color: #a2a6b2; font-size: 12px; font-weight: 500; letter-spacing: 0; }
        .nl-submit {
          display: inline-flex;
          height: 48px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: var(--nl-blue);
          color: #fff;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
          transition: transform .2s, background .2s, opacity .2s;
        }
        .nl-submit:hover:not(:disabled) { transform: translateY(-1px); background: var(--nl-blue-deep); }
        .nl-submit:disabled { cursor: not-allowed; opacity: .52; }
        .nl-notice { display: flex; min-height: 17px; align-items: center; gap: 5px; margin: 9px 0 0 5px; color: #68728a; font-size: 10px; }
        .nl-notice svg { color: #4f8a72; }
        .nl-divider { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 17px; margin: 41px 0 30px; }
        .nl-divider::before, .nl-divider::after { height: 1px; background: #e0e2e9; content: ""; }
        .nl-divider span { color: #81899a; font-size: 9px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
        .nl-followup { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(290px, .85fr); align-items: stretch; gap: clamp(24px, 4vw, 70px); }
        .nl-story { padding: 2px 0 10px; }
        .nl-story-index { display: inline-flex; align-items: center; gap: 8px; color: #6269a8; font-size: 10px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
        .nl-story-index strong { color: #e98976; font-family: "Manrope", system-ui, sans-serif; font-size: 12px; letter-spacing: -.03em; }
        .nl-story h2 { max-width: 600px; margin: 13px 0 0; font-family: "Manrope", "Avenir Next", system-ui, sans-serif; font-size: clamp(25px, 2.4vw, 34px); font-weight: 800; line-height: 1.16; letter-spacing: -.055em; }
        .nl-story p { max-width: 570px; margin: 12px 0 0; color: #727b8d; font-size: 13px; line-height: 1.7; }
        .nl-protect-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 115px;
          padding: 20px 23px;
          border: 1px solid #e2e3ea;
          border-radius: 19px;
          background: #fffefa;
          box-shadow: 0 8px 24px rgba(49,57,106,.04);
        }
        .nl-protect-card::after { position: absolute; top: 0; right: 22px; width: 37px; height: 3px; border-radius: 0 0 4px 4px; background: #ee927f; content: ""; }
        .nl-protect-icon { display: grid; width: 48px; height: 48px; flex: 0 0 auto; place-items: center; border-radius: 15px; background: #eaf3ec; color: #56866a; }
        .nl-protect-card h3 { margin: 0; font-size: 13px; font-weight: 800; }
        .nl-protect-card p { margin: 6px 0 0; color: #7b8392; font-size: 11px; line-height: 1.55; }
        .nl-seller {
          position: relative;
          display: flex;
          min-height: 127px;
          align-items: center;
          justify-content: space-between;
          gap: 26px;
          overflow: hidden;
          margin-top: 39px;
          padding: 24px clamp(22px, 3vw, 42px);
          border-radius: 22px;
          background: #354263;
          color: #fff;
        }
        .nl-seller::before { position: absolute; top: -93px; right: 154px; width: 208px; height: 208px; border: 1px solid rgba(235,237,255,.14); border-radius: 50%; content: ""; }
        .nl-seller::after { position: absolute; top: -66px; right: 181px; width: 154px; height: 154px; border: 1px solid rgba(235,237,255,.14); border-radius: 50%; content: ""; }
        .nl-seller-copy { position: relative; z-index: 1; }
        .nl-seller-label { display: flex; align-items: center; gap: 8px; color: #d2d6e7; font-size: 9px; font-weight: 850; letter-spacing: .15em; text-transform: uppercase; }
        .nl-seller h2 { margin: 8px 0 0; font-family: "Manrope", "Avenir Next", system-ui, sans-serif; font-size: clamp(20px, 2vw, 27px); font-weight: 800; letter-spacing: -.045em; }
        .nl-seller p { margin: 5px 0 0; color: #c1c8dc; font-size: 11px; line-height: 1.5; }
        .nl-seller-link { position: relative; z-index: 1; display: inline-flex; min-height: 44px; flex: 0 0 auto; align-items: center; gap: 10px; padding: 0 16px; border-radius: 12px; background: #fbfaf5; color: #303b5a; font-size: 11px; font-weight: 850; text-decoration: none; transition: transform .2s, background .2s; }
        .nl-seller-link:hover { transform: translateY(-2px); background: #f2efff; }
        .nl-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-top: 22px; color: #89909e; font-size: 10px; }
        .nl-footer-mark { display: flex; align-items: center; gap: 6px; color: #70798b; font-weight: 700; }
        .nl-footer-mark svg { color: #676fb4; }
        .nl-toast { position: fixed; right: 22px; bottom: 22px; z-index: 8; display: flex; max-width: min(420px, calc(100vw - 32px)); align-items: center; gap: 10px; padding: 13px 16px; border: 1px solid #d8e7dc; border-radius: 14px; background: #fffefa; color: #344f41; box-shadow: 0 12px 34px rgba(38,51,81,.14); font-size: 12px; font-weight: 650; animation: nl-rise .22s ease both; }
        .nl-toast svg { flex: 0 0 auto; }
        .nl-menu-toggle { display: none; }
        @keyframes nl-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1120px) {
          .nl-rail { width: 238px; min-width: 238px; padding-inline: 20px; }
          .nl-content { padding-top: 36px; }
          .nl-hero { grid-template-columns: minmax(0, 1fr) minmax(250px, .72fr); gap: 26px; }
          .nl-headline { font-size: clamp(46px, 5.7vw, 66px); }
        }
        @media (max-width: 820px) {
          .nl-frame { display: block; }
          .nl-rail { position: relative; width: 100%; min-width: 0; min-height: auto; padding: 15px 20px; overflow: visible; }
          .nl-rail::before, .nl-rail::after, .nl-rail-main, .nl-rail-footer { display: none; }
          .nl-rail-top { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
          .nl-brand-mark { width: 38px; height: 38px; }
          .nl-menu-toggle { display: grid; width: 39px; height: 39px; place-items: center; border: 1px solid rgba(255,255,255,.2); border-radius: 12px; background: transparent; color: #fff; cursor: pointer; }
          .nl-nav { display: none; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 13px 0 0; }
          .nl-nav.is-open { display: grid; }
          .nl-nav a { min-height: 41px; justify-content: center; gap: 7px; padding: 0 6px; font-size: 11px; }
          .nl-nav-icon { width: auto; }
          .nl-topbar { height: 61px; padding-inline: 20px; }
          .nl-content { padding: 35px 22px 36px; }
          .nl-hero { grid-template-columns: minmax(0, 1fr) minmax(230px, .75fr); min-height: 0; gap: 21px; }
          .nl-hero-art { min-height: 290px; }
          .nl-headline { font-size: clamp(43px, 7vw, 59px); }
          .nl-loc-row { grid-template-columns: 1fr; gap: 13px; padding: 15px; }
          .nl-loc-form { width: 100%; }
          .nl-followup { gap: 22px; }
        }
        @media (max-width: 620px) {
          .nl-topbar { height: 58px; padding-inline: 17px; }
          .nl-breadcrumb { font-size: 10px; }
          .nl-pin-status { display: none; }
          .nl-signin { height: 35px; padding-inline: 11px; font-size: 11px; }
          .nl-content { padding: 30px 17px 28px; }
          .nl-hero { display: flex; flex-direction: column; align-items: stretch; gap: 20px; }
          .nl-hero-copy { padding: 2px 0 0; }
          .nl-headline { max-width: 450px; margin-top: 17px; font-size: clamp(44px, 12vw, 60px); }
          .nl-hero-intro { margin-top: 14px; font-size: 13px; line-height: 1.65; }
          .nl-hero-art { min-height: 220px; border-radius: 21px; }
          .nl-map-tag { left: 12px; bottom: 12px; min-width: 190px; padding: 9px 11px; }
          .nl-map-caption { top: 14px; right: 14px; font-size: 8px; }
          .nl-loc-row { margin-top: 18px; padding: 13px; border-radius: 17px; }
          .nl-loc-copy { align-items: flex-start; }
          .nl-loc-icon { width: 39px; height: 39px; border-radius: 12px; }
          .nl-loc-copy b { font-size: 12px; }
          .nl-loc-copy span { max-width: 250px; font-size: 10px; }
          .nl-loc-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
          .nl-input-wrap { height: 45px; padding-inline: 10px; }
          .nl-input-wrap input::placeholder { font-size: 10px; }
          .nl-submit { height: 45px; gap: 6px; padding-inline: 12px; font-size: 10px; }
          .nl-notice { font-size: 9px; }
          .nl-divider { gap: 10px; margin: 29px 0 23px; }
          .nl-divider span { font-size: 8px; white-space: nowrap; }
          .nl-followup { grid-template-columns: 1fr; gap: 17px; }
          .nl-story h2 { font-size: 27px; }
          .nl-story p { font-size: 12px; }
          .nl-protect-card { min-height: 99px; padding: 16px; }
          .nl-protect-icon { width: 43px; height: 43px; }
          .nl-seller { align-items: flex-start; flex-direction: column; gap: 17px; margin-top: 25px; padding: 21px; border-radius: 18px; }
          .nl-seller::before { right: -69px; top: -132px; }
          .nl-seller::after { right: -42px; top: -105px; }
          .nl-seller h2 { font-size: 21px; }
          .nl-seller-link { min-height: 40px; }
          .nl-footer { align-items: flex-start; flex-direction: column; gap: 9px; padding-top: 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nl-page *, .nl-page *::before, .nl-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
        }
      `}</style>

      <div className="nl-frame">
        <aside className="nl-rail">
          <div>
            <div className="nl-rail-top">
              <a className="nl-brand" href="#home" aria-label="NearLoop home">
                <span className="nl-brand-mark"><MapPin size={21} strokeWidth={2.6} /></span>
                <span className="nl-brand-word">nearloop<span className="nl-brand-dot">.</span></span>
              </a>
              <button
                className="nl-menu-toggle"
                type="button"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                <Menu size={19} />
              </button>
            </div>
            <div className="nl-rail-main">
              <p className="nl-rail-note">The neighborhood guide</p>
              <h2 className="nl-rail-title">Shop local.<br />Discover nearby.</h2>
              <nav className="nl-nav" aria-label="Main navigation">
                <a className="is-current" href="#home" onClick={() => setMobileMenuOpen(false)}>
                  <span className="nl-nav-icon"><Compass size={17} /></span>Discover
                </a>
                <a href="#shops" onClick={() => setMobileMenuOpen(false)}>
                  <span className="nl-nav-icon"><Store size={17} /></span>Shops
                </a>
                <a href="#products" onClick={() => setMobileMenuOpen(false)}>
                  <span className="nl-nav-icon"><Package size={17} /></span>Find a product
                </a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>
                  <span className="nl-nav-icon"><ArrowDownRight size={17} /></span>How it works
                </a>
              </nav>
            </div>
          </div>
          <div className="nl-rail-footer">
            <div className="nl-rail-footer-rule" />
            <div className="nl-rail-footer-label"><Sparkles size={13} /> Close by, by design</div>
            <p className="nl-rail-footer-copy">A better way to meet the people and places just around the corner.</p>
          </div>
        </aside>

        <div className="nl-main" id="home">
          <header className="nl-topbar">
            <div className="nl-breadcrumb"><span className="nl-breadcrumb-mark" />A little closer to home</div>
            <div className="nl-top-actions">
              <div className="nl-pin-status"><MapPin size={14} />{activePin ? `PIN ${activePin}` : "Your location stays yours"}</div>
              <button className="nl-signin" type="button" onClick={() => setNotice("Sign in is ready when you open NearLoop in your neighborhood.")}>
                Sign in <ArrowUpRight size={14} />
              </button>
            </div>
          </header>

          <main className="nl-content">
            <section className="nl-hero" aria-labelledby="nl-title">
              <div className="nl-hero-copy">
                <div className="nl-eyebrow"><span className="nl-eyebrow-line" />Your neighborhood, verified</div>
                <h1 className="nl-headline" id="nl-title">Good things are<br />closer than <em>you think.</em></h1>
                <p className="nl-hero-intro">Meet the independent shops in your lane. Browse what’s on their shelves, then talk directly with the people who run them.</p>
              </div>

              <div className="nl-hero-art" aria-label="Illustrated map of nearby streets">
                <svg className="nl-map-svg" viewBox="0 0 460 360" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
                  <rect width="460" height="360" fill="#eeedff" />
                  <path d="M-30 63 C74 19 129 131 223 91 S370 28 496 86" fill="none" stroke="#d9d9f1" strokeWidth="29" />
                  <path d="M-27 63 C74 19 129 131 223 91 S370 28 496 86" fill="none" stroke="#fbfaf5" strokeWidth="19" />
                  <path d="M73 -21 C120 59 47 104 94 171 S177 261 122 385" fill="none" stroke="#d9d9f1" strokeWidth="27" />
                  <path d="M73 -21 C120 59 47 104 94 171 S177 261 122 385" fill="none" stroke="#fbfaf5" strokeWidth="18" />
                  <path d="M297 -25 C252 57 337 116 288 180 S217 281 284 390" fill="none" stroke="#d9d9f1" strokeWidth="30" />
                  <path d="M297 -25 C252 57 337 116 288 180 S217 281 284 390" fill="none" stroke="#fbfaf5" strokeWidth="20" />
                  <path d="M-10 248 C87 213 136 306 227 268 S370 224 474 280" fill="none" stroke="#d9d9f1" strokeWidth="27" />
                  <path d="M-10 248 C87 213 136 306 227 268 S370 224 474 280" fill="none" stroke="#fbfaf5" strokeWidth="18" />
                  <path d="M379 -12 C339 69 417 113 374 182 S335 286 390 372" fill="none" stroke="#dfdfef" strokeWidth="15" />
                  <path d="M-18 155 C65 126 167 192 238 157 S380 117 476 153" fill="none" stroke="#dfdfef" strokeWidth="14" />
                  <path d="M-18 155 C65 126 167 192 238 157 S380 117 476 153" fill="none" stroke="#fbfaf5" strokeWidth="8" />
                  <path d="M381 199 C414 218 434 238 468 239" fill="none" stroke="#fbfaf5" strokeWidth="14" />
                  <g fill="#e2e8df">
                    <rect x="149" y="26" width="83" height="42" rx="11" transform="rotate(-8 149 26)" />
                    <rect x="322" y="105" width="39" height="30" rx="9" transform="rotate(13 322 105)" />
                    <rect x="28" y="194" width="39" height="26" rx="8" transform="rotate(-12 28 194)" />
                    <rect x="320" y="292" width="67" height="35" rx="10" transform="rotate(-7 320 292)" />
                    <rect x="163" y="301" width="51" height="24" rx="8" transform="rotate(11 163 301)" />
                  </g>
                  <g fill="#f2e4d8" opacity=".9">
                    <rect x="153" y="177" width="56" height="36" rx="10" transform="rotate(-5 153 177)" />
                    <rect x="335" y="211" width="49" height="28" rx="9" transform="rotate(11 335 211)" />
                    <rect x="174" y="113" width="42" height="24" rx="8" transform="rotate(13 174 113)" />
                  </g>
                  <circle cx="220" cy="188" r="58" fill="#e2e1fb" opacity=".76" />
                  <circle cx="220" cy="188" r="40" fill="#d5d4f3" opacity=".73" />
                  <path d="M219 143c-19 0-34 15-34 34 0 26 34 60 34 60s34-34 34-60c0-19-15-34-34-34Z" fill="#414db2" />
                  <circle cx="219" cy="177" r="11" fill="#fbfaf5" />
                  <circle cx="93" cy="96" r="5" fill="#ed927f" stroke="#fbfaf5" strokeWidth="4" />
                  <circle cx="342" cy="165" r="5" fill="#ed927f" stroke="#fbfaf5" strokeWidth="4" />
                  <circle cx="147" cy="261" r="5" fill="#747ac6" stroke="#fbfaf5" strokeWidth="4" />
                </svg>
                <div className="nl-map-caption">A more local kind of map</div>
                <div className="nl-map-tag">
                  <span className="nl-map-tag-icon"><MapPin size={17} /></span>
                  <span><b>Right around you</b><span>{activePin ? `Serving ${activePin}` : "Find your neighborhood"}</span></span>
                </div>
              </div>
            </section>

            <section className="nl-loc-row" id="shops" aria-label="Find shops near you">
              <div className="nl-loc-copy">
                <span className="nl-loc-icon"><MapPin size={21} /></span>
                <span>
                  <b>{activePin ? `Your ${activePin} neighborhood` : "Start with your six-digit PIN"}</b>
                  <span>{activePin ? "Your local loop is ready to explore." : "We’ll only show shops serving this exact area."}</span>
                </span>
              </div>
              <div>
                <form className="nl-loc-form" onSubmit={submitPin}>
                  <label className="nl-input-wrap">
                    <MapPin size={17} />
                    <input
                      aria-label="Six digit PIN code"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      placeholder="Enter your 6-digit PIN"
                      value={pinDraft}
                      onChange={(event) => setPinDraft(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </label>
                  <button className="nl-submit" type="submit" disabled={pinDraft.length !== 6}>
                    Explore nearby <ArrowRight size={15} />
                  </button>
                </form>
                <div className="nl-notice" role="status" aria-live="polite">
                  {activePin && notice ? <><Check size={12} />{notice}</> : notice || "Exact area only. No broad, far-away results."}
                </div>
              </div>
            </section>

            <div className="nl-divider" id="products"><span>Small shops, big neighborhood energy</span></div>

            <section className="nl-followup" id="how-it-works">
              <div className="nl-story">
                <div className="nl-story-index"><strong>01</strong><span>NearLoop, in a nutshell</span></div>
                <h2>Start with the six digits on your doorstep.</h2>
                <p>Every listing is tied to a verified service PIN. No far-away results pretending to be local. Just people and products within reach.</p>
              </div>
              <div className="nl-protect-card">
                <span className="nl-protect-icon"><ShieldCheck size={22} /></span>
                <span><h3>Your location stays specific</h3><p>We never broaden your search behind your back. Your neighborhood is yours to define.</p></span>
                <ChevronRight size={17} color="#8b91a0" />
              </div>
            </section>

            <section className="nl-seller">
              <div className="nl-seller-copy">
                <div className="nl-seller-label"><Store size={13} />For the neighborhood makers</div>
                <h2>Your shop belongs in the loop.</h2>
                <p>Bring your products to nearby customers. No checkout, just real conversations.</p>
              </div>
              <a className="nl-seller-link" href="#shops" onClick={() => setNotice("Set your PIN to discover the shops and makers nearby.")}>
                List your shop <ArrowRight size={15} />
              </a>
            </section>

            <footer className="nl-footer">
              <span className="nl-footer-mark"><MessageCircle size={13} />A better way to meet the shops just around the corner.</span>
              <span>Local starts with a conversation.</span>
            </footer>
          </main>
        </div>
      </div>
      {notice && !activePin && (
        <div className="nl-toast" role="status" aria-live="polite">
          <Check size={16} />{notice}
        </div>
      )}
    </div>
  );
}
