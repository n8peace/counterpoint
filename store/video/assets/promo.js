/* Counterpoint promo: shared markup + one paused GSAP timeline for both cuts.
   window.mountPromo() injects the scene markup; window.buildPromo(mode) returns the timeline.
   All text comes from store/shots (made-up sites and saved demo answers). */
(function () {
  const MARK = (cls = "mark") =>
    `<svg class="${cls}" viewBox="0 0 40 16" aria-hidden="true"><path class="p1" d="M2 14 C 14 14, 26 2, 38 2"/><path class="p2" d="M2 2 C 14 2, 26 14, 38 14"/></svg>`;
  const I = {
    copy: `<svg class="ico" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
    refresh: `<svg class="ico" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>`,
    more: `<svg class="ico" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`,
    search: `<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>`,
    send: `<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
    gh: `<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
  };
  const actions = `<div class="answer-actions"><span>${I.copy}</span><span>${I.refresh}</span></div>`;
  const moreBtn = (id) => `<div class="more-wrap" id="${id}"><span class="tonal-btn">${I.more}Say more</span>
    <div class="more-loading"><div class="line w90"></div><div class="line w80"></div><div class="line w60"></div></div></div>`;
  const skel = (id) => `<div class="skeleton" id="${id}">
    <div class="card says"><div class="line w40"></div><div class="line w90"></div><div class="line w60"></div></div>
    <div class="card counter"><div class="line w40"></div><div class="line w90"></div><div class="line w80"></div><div class="line w60"></div></div></div>`;
  const pts = (items, cls = "") => `<ul class="points ${cls}">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;

  const CAPS = [
    ["Every page wants you to <em>believe something</em>.", ""],
    ["See the <em>other side</em> of any page", "Counterpoint names what a page is pushing and makes the strongest honest case against it."],
    ["Say more for the <em>full case</em>", "What would settle it, searches to read further, and side-by-side comparisons."],
    ["Keep pushing with <em>follow-ups</em>", "Ask anything about the other side, right in the panel."],
    ["Highlight any claim to <em>challenge it</em>", "Right-click selected text and choose Counterpoint this."],
  ];

  const PAGES = `
  <div class="page" id="pg-ring"><div class="shop"><div class="photo"></div><div>
    <div class="brand">Noctra</div><h2>Noctra Ring</h2>
    <p class="price">$349 <span class="small">+ $6/month membership</span></p>
    <p class="small"><span class="pitch" id="pitch">Know your sleep. Fix your sleep. Wake up ready.</span></p>
    <span class="buy">Add to cart</span>
    <ul class="perks"><li>Tracks deep, light and REM sleep</li><li>Nightly sleep score and coaching</li><li>7-day battery, titanium build</li></ul></div></div></div>
  <div class="page" id="pg-remote"><div class="article"><div class="kicker">Opinion</div><h2>The office is over. Good riddance.</h2><div class="by">Editorial · 6 min read</div>
    <p>Three years of data have settled the question. People do their best work when they control their time and space, and the daily commute was always a tax we pretended not to notice.</p>
    <p>Companies that dragged everyone back are losing talent to companies that didn't. The office had a good run. It's time to let it go.</p></div></div>
  <div class="page" id="pg-ev"><div class="ev"><div class="brand">Arden EV</div><h2>Go electric. Save every year.</h2><div class="hero"></div>
    <div class="stat"><b>$1,200</b><span>yearly fuel savings*</span></div><div class="stat"><b>310 mi</b><span>range</span></div><div class="stat"><b>$0</b><span>oil changes</span></div></div></div>
  <div class="page" id="pg-sel"><div class="article"><div class="kicker">Work</div><h2>The four-day week is coming</h2><div class="by">Work desk · 4 min read</div>
    <p data-layout-allow-overlap>After a wave of trials, the verdict is in. <mark class="sel" id="claim">A four-day week makes every company more productive.</mark> Workers are happier, and output holds steady or rises.</p>
    <p data-layout-allow-overlap>Holdouts are running out of excuses. The five-day week is a habit, not a law of nature.</p></div>
    <div class="menu" id="menu" data-layout-allow-overlap><div data-layout-allow-overlap>Copy</div><div data-layout-allow-overlap>Search Google for this</div><hr><div class="cp" id="cp"><i class="cp-hl" id="cp-hl"></i>${MARK()}<span>Counterpoint this</span></div><hr><div data-layout-allow-overlap>Inspect</div></div></div>`;

  const HEADS = [
    ["ph-ring", "shop.noctra.com", "Noctra Ring: Sleep smarter"],
    ["ph-remote", "brightwaterreview.com", "The office is over. Good riddance."],
    ["ph-ev", "arden-ev.com", "Arden EV: Go electric. Save every year."],
    ["ph-sel", "Selection on northgatedaily.com", "Northgate Daily: The four-day week is coming"],
  ];

  const VIEWS = `
  <div class="view" id="v-ring">${skel("sk-ring")}<div class="scroller" id="sc-ring">
    <section class="card says a1"><p class="label">The page says</p><p class="claim">You should buy the Noctra Ring to understand and improve your sleep.</p></section>
    <section class="card counter a2"><p class="label">The other side</p><h2 class="thesis">Most people sleep no better a year after buying a tracker, and $349 plus a monthly fee buys advice you can get for free.</h2></section>
    <section class="section"><h3 class="section-head a3">Strongest arguments</h3>${pts([
      "Rings estimate sleep stages from pulse and movement, and they're much less accurate on stages than the ads suggest.",
      "The advice it ends up giving, a steady bedtime and less late caffeine, is free and well known.",
      "Some people sleep worse from chasing a nightly score, a pattern sleep researchers call orthosomnia.",
    ], "a4")}</section></div></div>

  <div class="view" id="v-remote-a"><div class="scroller" id="sc-remote-a">
    <section class="card says"><p class="label">The page says</p><p class="claim">Remote work is better for workers and companies.</p></section>
    <section class="card counter"><p class="label">The other side</p><h2 class="thesis">For many people the office builds skills and careers.</h2></section>
    <section class="section"><h3 class="section-head">Strongest arguments</h3>${pts([
      "Junior staff learn by overhearing and asking quick questions; remote setups make that slower and more formal.",
      "Promotions tend to go to people senior leaders see and know, which favors whoever is in the room.",
    ])}</section>
    ${moreBtn("more-remote")}${actions}</div></div>

  <div class="view" id="v-remote-b"><div class="scroller" id="sc-remote-b">
    <section class="card says"><p class="label">The page says</p><p class="claim">Remote work is better for workers and companies, and the office is a relic.</p></section>
    <section class="card counter"><p class="label">The other side</p><h2 class="thesis">For many people, especially early in their careers, the office is where skills, trust and promotions get built, and fully remote work quietly taxes them.</h2></section>
    <section class="section"><h3 class="section-head">Strongest arguments</h3>${pts([
      "Junior staff learn by overhearing and asking quick questions; remote setups make that slower and more formal.",
      "Promotions tend to go to people senior leaders see and know, which favors whoever is in the room.",
      "Collaboration across teams tends to shrink when everyone is remote, even when individual focus improves.",
    ])}</section>
    <div class="chart" id="chart"><h4>What each setup is best at</h4><table class="compare"><thead><tr><th></th><th>Fully remote</th><th>Hybrid</th></tr></thead><tbody>
      <tr class="cr"><th>Focus time</th><td>Strong</td><td>Strong</td></tr>
      <tr class="cr"><th>Learning on the job</th><td>Slower</td><td>Faster</td></tr>
      <tr class="cr"><th>Visibility</th><td>Harder</td><td>Easier</td></tr>
      <tr class="cr"><th>Commute</th><td>None</td><td>2 to 3 days</td></tr></tbody></table>
      <p class="note">A summary of tradeoffs, not measured data.</p></div>
    <section class="section" id="settle"><h3 class="section-head">What would settle it</h3>${pts([
      "Skill growth and promotion rates for junior staff at remote versus hybrid companies over several years.",
    ], "settle")}</section>
    <section class="section" id="search"><h3 class="section-head">Search the other side</h3><div class="chips">
      <span class="chip">${I.search}<span>remote work mentorship junior employees research</span></span>
      <span class="chip">${I.search}<span>remote work collaboration network study</span></span></div></section>
    ${actions}</div></div>

  <div class="view" id="v-ev"><div class="scroller" id="sc-ev">
    <section class="card says"><p class="label">The page says</p><p class="claim">Switching to this electric car will save you money every year.</p></section>
    <section class="card counter"><p class="label">The other side</p><h2 class="thesis">Whether an EV saves you money depends on how much you drive and what you pay for power, and for many drivers the payback takes years.</h2></section>
    <section class="section"><h3 class="section-head">Strongest arguments</h3>${pts([
      "The savings figure assumes average mileage; drive less and the yearly savings shrink with it.",
      "A higher sticker price and a home charger can take years of fuel savings to pay back.",
      "Public fast charging can cost about as much per mile as gas.",
    ])}</section>
    ${moreBtn("more-ev")}${actions}
    <div class="turn" id="turn"><div class="q" id="q">What if I only drive 5,000 miles a year?</div>
      <div class="typing" id="dots"><i></i><i></i><i></i></div>
      <div class="a" id="ans"><p class="b1">Then the money case gets much weaker:</p><ul>
        <li class="b2">Fuel savings scale with miles, so at about half the typical mileage you'd save about half the advertised amount.</li>
        <li class="b3">That stretches the payback on the higher price past the point many people keep a car.</li>
        <li class="b4">Check what you actually spent on gas last year before deciding.</li></ul></div></div></div></div>

  <div class="view" id="v-new"><div class="state"><div class="logo">${MARK()}</div><h2>New page</h2><p>Want the other side of this one?</p><span class="filled-btn">Counterpoint this page</span></div></div>

  <div class="view" id="v-sel">${skel("sk-sel")}<div class="scroller" id="sc-sel">
    <section class="card says s1"><p class="label">The page says</p><p class="claim">A four-day work week makes companies more productive.</p></section>
    <section class="card counter s2"><p class="label">The other side</p><h2 class="thesis">The trials behind this claim mostly involved companies that chose to try it, so they can't show it would work everywhere.</h2></section>
    <section class="section"><h3 class="section-head s3">Strongest arguments</h3>${pts([
      "Companies that volunteer for a four-day trial expect it to work, which tilts the results.",
      "Many results rest on self-reported productivity rather than measured output.",
      "Jobs tied to coverage hours, like support or healthcare, can't compress the week the same way.",
    ], "s4")}</section></div></div>`;

  const STAGE = `
  <div class="cam" id="cam"><div class="scaler"><div class="window">
    <div class="toolbar"><div class="dots"><i></i><i></i><i></i></div>
      <div class="url">
        <span id="u-ring"><b>shop.noctra.com</b>/ring</span>
        <span id="u-remote"><b>brightwaterreview.com</b>/opinion/office-is-over</span>
        <span id="u-ev"><b>arden-ev.com</b>/save</span>
        <span id="u-sel"><b>northgatedaily.com</b>/work/four-day-week</span></div>
      <div class="ext" id="ext"><i class="ext-ring" id="ext-ring"></i>${MARK()}</div></div>
    <div class="wbody" id="wbody">${PAGES}
      <aside class="panel" id="panel">
        <div class="ptop">${HEADS.map(([id, h, t]) => `<div class="phead" id="${id}"><span class="host">${h}</span><span class="page-title">${t}</span></div>`).join("")}
          <span class="gear">${I.gear}</span></div>
        <div class="pmain" id="pmain">${VIEWS}</div>
        <footer class="composer" id="composer"><div class="ask"><div class="ask-text"><span class="ph" id="ph">Ask a follow-up</span><span class="typed" id="typed"><span id="typed-t"></span><i class="caret" id="caret"></i></span></div>
          <span class="send" id="send"><i class="send-on" id="send-on"></i>${I.send}</span></div>
          <p class="via">Chrome built-in AI · on this computer</p></footer>
      </aside></div>
    <div class="ripple" id="ripple"></div>
    <div class="cursor" id="cursor"><svg viewBox="0 0 22 24"><path d="M2 2 L2 19 L6.6 14.6 L9.8 21.6 L12.9 20.2 L9.8 13.4 L16.2 13.2 Z" fill="#1f1f1f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
  </div></div></div>`;

  const END = `
    <div class="tile" id="e-tile">${MARK("mark e-mark")}</div>
    <div class="e-name" id="e-name">Counterpoint</div>
    <div class="e-tag" id="e-tag">See the other side of any page</div>
    <div class="e-rule" id="e-rule"></div>
    <div class="e-info" id="e-info">Free on Chrome's built-in AI <b>·</b> Open source</div>
    <div class="e-url" id="e-url">${I.gh}github.com/n8peace/counterpoint</div>`;

  window.mountPromo = function () {
    const $ = (s) => document.querySelector(s);
    $("#caps").innerHTML = CAPS.map(([h, p], i) => `<div class="cap" id="cap${i}"><h1>${h}</h1>${p ? `<p>${p}</p>` : ""}</div>`).join("");
    $("#stage").innerHTML = STAGE;
    $("#endcard").innerHTML = END;
  };

  window.buildPromo = function (mode) {
    const square = mode === "square";
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
    const SCALE = parseFloat(getComputedStyle($("#root")).getPropertyValue("--scale"));

    // ---- geometry, measured once at setup (layout px inside the window, unaffected by transforms)
    const viewH = $("#pmain").offsetHeight - 24; // minus view padding
    const PANEL_X = 680; // panel's left edge inside the window
    const within = (el, anc) => { let x = 0, y = 0; while (el && el !== anc) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x, y }; };
    const scrollTo = (scId, targetEl, pad = 8) => {
      const sc = $(scId); const y = within(targetEl, sc).y;
      return -Math.max(0, Math.min(y - pad, sc.offsetHeight - viewH));
    };
    const bottomOf = (scId) => -Math.max(0, $(scId).offsetHeight - viewH);
    const wb = $("#wbody");

    // ---- helpers
    const fadeIn = (s, t, d = 0.4, y = 10) => tl.fromTo(s, { opacity: 0, y }, { opacity: 1, y: 0, duration: d, ease: "power3.out" }, t);
    const fadeOut = (s, t, d = 0.3) => tl.to(s, { opacity: 0, duration: d, ease: "power1.in" }, t);
    const swap = (a, b, t, d = 0.35) => { tl.to(a, { opacity: 0, duration: d, ease: "power1.inOut" }, t); tl.to(b, { opacity: 1, duration: d, ease: "power1.inOut" }, t); };
    const cur = (x, y, t, d = 0.6, ease = "power2.inOut") => tl.to("#cursor", { x, y, duration: d, ease }, t);
    const click = (x, y, t) => {
      tl.fromTo("#ripple", { x, y, scale: 0.4, opacity: 0.55 }, { scale: 1.5, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo("#cursor svg", { scale: 1 }, { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.inOut", transformOrigin: "10% 10%", immediateRender: false }, t);
    };
    const shimmer = (sel, t, d) => tl.fromTo(`${sel} .line`, { backgroundPosition: "100% 0" }, { backgroundPosition: "-100% 0", duration: d, ease: "none" }, t);
    // camera (square cut only): page view vs panel view
    const CAM = { page: 0, panel: -548 };
    const cam = (where, t, d = 0.8) => { if (square) tl.to("#cam", { x: CAM[where], duration: d, ease: "power2.inOut" }, t); };

    // ---- scene times
    const S2 = 2.7, S3 = 7.7, S4 = 11.9, S5 = 16.4, S6 = 21.4, END_T = 25;

    // background drift (slow, finite)
    tl.fromTo(".glow-a", { x: 0, y: 0 }, { x: 160, y: 60, duration: END_T, ease: "sine.inOut" }, 0);
    tl.fromTo(".glow-b", { x: 0, y: 0 }, { x: -140, y: -50, duration: END_T, ease: "sine.inOut" }, 0);
    tl.fromTo(".glow-c", { x: 0, scale: 1 }, { x: -120, scale: 1.15, duration: END_T, ease: "sine.inOut" }, 0);

    // ===== S1: the page and the hook
    tl.set("#u-ring, #pg-ring", { opacity: 1 }, 0);
    tl.fromTo("#cam", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: "power3.out" }, 0.05);
    if (square) tl.set("#cam", { x: CAM.page }, 0);
    fadeIn("#cap0", 0.25, 0.7, 22);
    tl.to("#pitch", { backgroundSize: "100% 100%", duration: 0.7, ease: "power2.inOut" }, 1.0);
    tl.set("#cursor", { x: 560, y: 470 }, 0);
    tl.to("#cursor", { opacity: 1, duration: 0.25 }, 1.2);
    cam("panel", 1.45, 0.85);
    cur(1092, 26, 1.3, 0.95);
    click(1092, 24, 2.3);
    tl.fromTo("#ext", { scale: 1 }, { scale: 0.88, duration: 0.09, yoyo: true, repeat: 1, ease: "power1.inOut" }, 2.3);
    tl.to("#ext-ring", { opacity: 1, duration: 0.25 }, 2.4);

    // ===== S2: panel slides in, short answer
    tl.fromTo("#panel", { x: 440 }, { x: 0, duration: 0.6, ease: "power3.out" }, S2 - 0.15);
    tl.set("#ph-ring, #v-ring", { opacity: 1 }, S2 - 0.15);
    tl.to("#cursor", { x: 1010, y: 160, opacity: 0, duration: 0.5, ease: "power1.in" }, S2);
    tl.to("#cap0", { opacity: 0, y: -14, duration: 0.35, ease: "power1.in" }, S2 - 0.1);
    fadeIn("#cap1", S2 + 0.2, 0.55, 16);
    tl.set("#sk-ring", { opacity: 1 }, S2 + 0.3);
    shimmer("#sk-ring", S2 + 0.3, 0.75);
    tl.to("#sk-ring", { opacity: 0, duration: 0.2 }, S2 + 0.9);
    tl.set("#sc-ring > *, #sc-ring .a3, #sc-ring .a4 li", { opacity: 0 }, 0);
    fadeIn("#sc-ring .a1", S2 + 1.0, 0.4, 6);
    fadeIn("#sc-ring .a2", S2 + 1.3, 0.45, 6);
    tl.set("#sc-ring .section", { opacity: 1 }, S2 + 1.85);
    fadeIn("#sc-ring .a3", S2 + 1.85, 0.35, 6);
    $$("#sc-ring .a4 li").forEach((li, i) => fadeIn(li, S2 + 2.05 + i * 0.4, 0.4, 6));
    // scroll only if the third argument would land below the fold (square cut)
    const a4 = $("#sc-ring .a4"), ringOver = within(a4, $("#sc-ring")).y + a4.offsetHeight + 6 - viewH;
    if (ringOver > 0) tl.to("#sc-ring", { y: -ringOver, duration: 0.7, ease: "power2.inOut" }, S2 + 2.75);

    // ===== S3: Say more
    swap("#pg-ring", "#pg-remote", S3, 0.4);
    swap("#u-ring", "#u-remote", S3, 0.4);
    swap("#ph-ring", "#ph-remote", S3, 0.4);
    swap("#v-ring", "#v-remote-a", S3, 0.4);
    tl.set("#sc-remote-a", { y: bottomOf("#sc-remote-a") }, 0);
    tl.to("#cap1", { opacity: 0, y: -14, duration: 0.35, ease: "power1.in" }, S3 - 0.1);
    fadeIn("#cap2", S3 + 0.2, 0.55, 16);
    const mr = within($("#more-remote"), $("#sc-remote-a"));
    const morePt = { x: PANEL_X + 12 + mr.x + 56, y: 48 + 58 + 4 + mr.y + bottomOf("#sc-remote-a") + 18 };
    tl.set("#cursor", { x: 860, y: 420 }, S3 + 0.3);
    tl.to("#cursor", { opacity: 1, duration: 0.25 }, S3 + 0.35);
    cur(morePt.x, morePt.y, S3 + 0.4, 0.75);
    click(morePt.x, morePt.y, S3 + 1.2);
    tl.fromTo("#more-remote .tonal-btn", { scale: 1 }, { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 }, S3 + 1.2);
    tl.to("#more-remote .tonal-btn", { opacity: 0, duration: 0.2 }, S3 + 1.4);
    tl.to("#more-remote .more-loading", { opacity: 1, duration: 0.2 }, S3 + 1.45);
    shimmer("#more-remote", S3 + 1.45, 0.6);
    tl.to("#cursor", { opacity: 0, x: morePt.x + 40, y: morePt.y + 60, duration: 0.4, ease: "power1.in" }, S3 + 1.5);
    const chartY = scrollTo("#sc-remote-b", $("#chart"), 10);
    tl.set("#sc-remote-b", { y: chartY }, 0);
    tl.set("#chart .cr, #chart .note, #settle, #search", { opacity: 0 }, 0);
    swap("#v-remote-a", "#v-remote-b", S3 + 2.0, 0.3);
    fadeIn("#chart h4", S3 + 2.05, 0.3, 4);
    $$("#chart .cr").forEach((r, i) => fadeIn(r, S3 + 2.15 + i * 0.12, 0.3, 4));
    fadeIn("#chart .note", S3 + 2.65, 0.3, 0);
    fadeIn("#settle", S3 + 2.8, 0.4, 6);
    fadeIn("#search", S3 + 3.0, 0.4, 6);
    tl.to("#sc-remote-b", { y: Math.min(chartY, scrollTo("#sc-remote-b", $("#settle"), -150)), duration: 0.8, ease: "power2.inOut" }, S3 + 3.0);

    // ===== S4: follow-up question
    swap("#pg-remote", "#pg-ev", S4, 0.4);
    swap("#u-remote", "#u-ev", S4, 0.4);
    swap("#ph-remote", "#ph-ev", S4, 0.4);
    swap("#v-remote-b", "#v-ev", S4, 0.4);
    tl.to("#cap2", { opacity: 0, y: -14, duration: 0.35, ease: "power1.in" }, S4 - 0.1);
    fadeIn("#cap3", S4 + 0.2, 0.55, 16);
    tl.set("#turn", { opacity: 0 }, 0);
    tl.set("#ans p, #ans li", { opacity: 0 }, 0);
    tl.set("#typed", { opacity: 0 }, 0);
    // before the question, the view ends at the Say more row (turn not yet there)
    const turnY = within($("#turn"), $("#sc-ev")).y;
    tl.set("#sc-ev", { y: -Math.max(0, turnY - viewH) }, 0);
    const Q = "What if I only drive 5,000 miles a year?";
    const typeStart = S4 + 0.55, typeDur = 1.35;
    tl.set("#ph", { opacity: 0 }, typeStart);
    tl.set("#typed", { opacity: 1 }, typeStart);
    const tp = { n: 0 };
    tl.fromTo(tp, { n: 0 }, { n: Q.length, duration: typeDur, ease: "none", onUpdate: () => { $("#typed-t").textContent = Q.slice(0, Math.round(tp.n)); } }, typeStart);
    tl.to("#send-on", { opacity: 1, duration: 0.15 }, typeStart + 0.05);
    tl.to("#send", { color: "#ffffff", duration: 0.15 }, typeStart + 0.05);
    const sendT = typeStart + typeDur + 0.2;
    tl.fromTo("#send", { scale: 1 }, { scale: 0.88, duration: 0.09, yoyo: true, repeat: 1 }, sendT);
    tl.set("#typed", { opacity: 0 }, sendT + 0.15);
    tl.set("#ph", { opacity: 1 }, sendT + 0.15);
    tl.to("#send-on", { opacity: 0, duration: 0.15 }, sendT + 0.15);
    tl.to("#send", { color: "#c4c7c5", duration: 0.15 }, sendT + 0.15);
    tl.to("#turn", { opacity: 1, duration: 0.01 }, sendT + 0.15);
    fadeIn("#q", sendT + 0.15, 0.35, 8);
    tl.to("#sc-ev", { y: bottomOf("#sc-ev"), duration: 0.7, ease: "power2.inOut" }, sendT + 0.15);
    tl.fromTo("#dots", { opacity: 0 }, { opacity: 1, duration: 0.15 }, sendT + 0.4);
    tl.fromTo("#dots i", { opacity: 0.25 }, { opacity: 1, duration: 0.2, stagger: 0.1, yoyo: true, repeat: 1, ease: "sine.inOut" }, sendT + 0.45);
    tl.to("#dots", { opacity: 0, duration: 0.1 }, sendT + 0.9);
    ["#ans .b1", "#ans .b2", "#ans .b3", "#ans .b4"].forEach((s, i) => fadeIn(s, sendT + 0.95 + i * 0.22, 0.35, 6));

    // ===== S5: highlight a claim → Counterpoint this
    swap("#pg-ev", "#pg-sel", S5, 0.4);
    swap("#u-ev", "#u-sel", S5, 0.4);
    swap("#ph-ev", "#ph-sel", S5, 0.4);
    swap("#v-ev", "#v-new", S5, 0.4);
    tl.to("#composer", { opacity: 0, duration: 0.3 }, S5);
    tl.to("#cap3", { opacity: 0, y: -14, duration: 0.35, ease: "power1.in" }, S5 - 0.1);
    fadeIn("#cap4", S5 + 0.2, 0.55, 16);
    cam("page", S5, 0.8);
    const rects = Array.from($("#claim").getClientRects());
    const wr = wb.getBoundingClientRect();
    const toLocal = (r) => ({ x: (r.left - wr.left) / SCALE, y: (r.top - wr.top) / SCALE + 48, r: (r.right - wr.left) / SCALE, b: (r.bottom - wr.top) / SCALE + 48 });
    const first = toLocal(rects[0]), last = toLocal(rects[rects.length - 1]);
    const selStart = { x: first.x + 1, y: first.y + 14 }, selEnd = { x: last.r - 1, y: last.y + 14 };
    tl.set("#cursor", { x: selStart.x - 60, y: selStart.y + 90 }, S5 + 0.3);
    tl.to("#cursor", { opacity: 1, duration: 0.25 }, S5 + 0.4);
    cur(selStart.x, selStart.y, S5 + 0.45, 0.55);
    tl.to("#claim", { backgroundSize: "100% 100%", duration: 0.75, ease: "power1.inOut" }, S5 + 1.1);
    tl.to("#cursor", { keyframes: [{ x: first.r, y: first.y + 14, duration: 0.42 }, { x: last.x + 2, y: last.y + 14, duration: 0.05 }, { x: selEnd.x, y: selEnd.y, duration: 0.28 }], ease: "none" }, S5 + 1.1);
    const menuAt = { x: selEnd.x - 120, y: selEnd.y + 26 };
    const menuT = S5 + 2.05;
    cur(menuAt.x + 6, menuAt.y - 4, S5 + 1.95, 0.12, "power1.out");
    tl.fromTo("#menu", { x: menuAt.x, y: menuAt.y - 48, opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" }, menuT);
    const cpPt = { x: menuAt.x + 110, y: menuAt.y + 6 + within($("#cp"), $("#menu")).y + 16 };
    cur(cpPt.x, cpPt.y, menuT + 0.3, 0.4);
    tl.to("#cp-hl", { opacity: 1, duration: 0.12 }, menuT + 0.6);
    click(cpPt.x, cpPt.y, menuT + 0.85);
    tl.to("#menu", { opacity: 0, duration: 0.2 }, menuT + 1.0);
    tl.to("#cursor", { opacity: 0, duration: 0.3 }, menuT + 1.05);
    const ansT = menuT + 1.0;
    cam("panel", ansT - 0.05, 0.8);
    tl.to("#v-new", { opacity: 0, duration: 0.2 }, ansT);
    tl.set("#v-sel", { opacity: 1 }, ansT);
    tl.set("#sc-sel > *, #sc-sel .s3, #sc-sel .s4 li", { opacity: 0 }, 0);
    tl.set("#sk-sel", { opacity: 1 }, ansT + 0.05);
    shimmer("#sk-sel", ansT + 0.05, 0.5);
    tl.to("#sk-sel", { opacity: 0, duration: 0.2 }, ansT + 0.5);
    tl.to("#composer", { opacity: 1, duration: 0.3 }, ansT + 0.6);
    fadeIn("#sc-sel .s1", ansT + 0.6, 0.4, 6);
    fadeIn("#sc-sel .s2", ansT + 0.85, 0.45, 6);
    tl.set("#sc-sel .section", { opacity: 1 }, ansT + 1.3);
    fadeIn("#sc-sel .s3", ansT + 1.3, 0.3, 6);
    $$("#sc-sel .s4 li").forEach((li, i) => fadeIn(li, ansT + 1.45 + i * 0.25, 0.35, 6));

    // ===== S6: end card
    tl.to("#cam", { opacity: 0, y: -30, duration: 0.55, ease: "power2.in" }, S6);
    tl.to("#cap4", { opacity: 0, y: -14, duration: 0.4, ease: "power1.in" }, S6);
    const paths = $$(".e-mark path");
    paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L}`; p.style.strokeDashoffset = `${L}`; });
    const E = S6 + 0.45;
    tl.fromTo("#e-tile", { scale: 0.82, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.3)" }, E);
    tl.to(paths[0], { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, E + 0.3);
    tl.to(paths[1], { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut" }, E + 0.42);
    fadeIn("#e-name", E + 0.55, 0.6, 24);
    fadeIn("#e-tag", E + 0.8, 0.55, 16);
    tl.fromTo("#e-rule", { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, E + 1.0);
    fadeIn("#e-info", E + 1.1, 0.5, 12);
    fadeIn("#e-url", E + 1.3, 0.5, 12);

    return tl;
  };
})();
