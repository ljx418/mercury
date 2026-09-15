import"./_virtual_wxt-html-plugins-DxF70BK8.js";import{t as e}from"./mermaid.core-WNoitGhZ.js";var t=document.querySelector(`#root`);e.initialize({startOnLoad:!1,securityLevel:`strict`}),i(),window.addEventListener(`message`,e=>{let t=e.data;t?.type===`navia.renderMermaid`&&(typeof t.artifactId!=`string`||typeof t.source!=`string`||n(t.artifactId,t.source,e.origin))});async function n(n,i,a){let o=`navia_mermaid_${n.replace(/\W/g,`_`)}`;try{let s=await e.render(o,i);t.dataset.rendered=`true`,t.innerHTML=s.svg,window.parent.postMessage({type:`navia.mermaidRendered`,artifactId:n,status:`succeeded`},r(a))}catch(e){t.dataset.rendered=`false`,t.innerHTML=`<p class="error">Mermaid 渲染失败</p>`,window.parent.postMessage({type:`navia.mermaidRendered`,artifactId:n,status:`failed`,message:e instanceof Error?e.message:`Mermaid render failed`},r(a))}}function r(e){return e===`null`?`*`:e}function i(){let e=document.createElement(`style`);e.textContent=`
    html, body {
      margin: 0;
      min-height: 100%;
      background: #ffffff;
      color: #172033;
      font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #root {
      min-height: 220px;
      overflow: auto;
      padding: 8px;
      box-sizing: border-box;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
    .placeholder,
    .error {
      margin: 0 0 8px;
      color: #52606d;
    }
  `,document.head.appendChild(e)}