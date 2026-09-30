// Local, lightweight outline icon set keeps the prototype polished and available offline.
(() => {
  const paths = {
    '🌱':'<path d="M12 21v-9"/><path d="M12 13c-5 0-8-3-8-8 5 0 8 3 8 8Z"/><path d="M12 17c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
    '🍊':'<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12m0 0 6-6m-6 6 8 2m-8-2-2 8m2-8-7-4"/>',
    '📚':'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6v15m5-14h7"/>',
    '💧':'<path d="M12 3c-2.3 3.7-6.5 7.4-6.5 11.4a6.5 6.5 0 0 0 13 0C18.5 10.4 14.3 6.7 12 3Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    '🔺':'<path d="m12 4 9 16H3L12 4Z"/>',
    '🤝':'<path d="m8 12 2.5-2.5a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1-2.8 2.8l-2-2"/><path d="m5 9 2-2a2 2 0 0 1 2.8 0l1.2 1.2M4 10l-1.5 1.5a2 2 0 0 0 0 2.8l3.2 3.2a2 2 0 0 0 2.8 0l1-1"/><path d="m19 10 2 2a2 2 0 0 1 0 2.8l-1 1"/>',
    '🔥':'<path d="M12 22c4.5 0 7-3 7-7 0-3-2-5-4-8-.3 2-1 3-2 4-1-4-3-6-5-8 0 5-3 8-3 12 0 4 3 7 7 7Z"/>',
    '📖':'<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v17H5.5A2.5 2.5 0 0 0 3 22V5.5Zm18 0A2.5 2.5 0 0 0 18.5 3H12v17h6.5a2.5 2.5 0 0 1 2.5 2V5.5Z"/>',
    '📝':'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8m-8 4h8"/>',
    '🔊':'<path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/>',
    '📈':'<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/><path d="M16 6h4v4"/>',
    '👥':'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    '💌':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    '🔄':'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 1m-14 10-2-1m14-1a7 7 0 0 1-12.5 3"/>',
    '🔎':'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    '🔐':'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
    '🔒':'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    '💡':'<path d="M9 18h6m-5 4h4m-2-20a7 7 0 0 0-4 12.7c.8.6 1 1.2 1 2.3h6c0-1.1.2-1.7 1-2.3A7 7 0 0 0 12 2Z"/>',
    '🎯':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    '🏠':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10Z"/>',
    '💛':'<path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>',
    '💚':'<path d="M20.8 8.7c0 5.2-8.8 10.3-8.8 10.3S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>',
    '🌿':'<path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-6 9-16Z"/><path d="M4 21c3-5 7-8 12-11"/>',
    '🌟':'<path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z"/>',
    '👋':'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4L3 15a1.8 1.8 0 0 1 3-2l2 2"/>',
    '📊':'<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"/><path d="M2 21h20"/>',
    '🧰':'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3m-13 5h18m-11 0v2h4v-2"/>',
    '🛠️':'<path d="m14.7 6.3 3 3M3 21l9.6-9.6m-3.8-4.8a5 5 0 0 0 6.7 6.7l5.1 5.1a2.1 2.1 0 0 1-3 3l-5.1-5.1A5 5 0 0 0 5.8 9.6L3 6.8l3.8-3.8 2.8 2.8Z"/>',
    '🌐':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/>',
    '✿':'<circle cx="12" cy="12" r="2"/><path d="M12 10c-3-3-1-7 1-7 2 0 3 4-1 7Zm2 2c3-3 7-1 7 1 0 2-4 3-7-1Zm-2 2c3 3 1 7-1 7-2 0-3-4 1-7Zm-2-2c-3 3-7 1-7-1 0-2 4-3 7 1Z"/>',
    '🧒':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    '👩🏾‍🏫':'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0M3 4h18M7 4v3m10-3v3"/>',
    '👨‍👧':'<circle cx="9" cy="7" r="3.5"/><circle cx="17" cy="12" r="2.5"/><path d="M2 21a7 7 0 0 1 14 0m-1-4a5 5 0 0 1 8 4"/>',
    '👩':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    '👨':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    '♿':'<circle cx="10" cy="4" r="1.5"/><path d="m8 8 4-1 2 5h5m-8-5-2 6 5 1 2 4m-10-3a6 6 0 1 0 11 1"/>',
    '⏱':'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6m-3 0v3"/>',
    '◉':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>', '●':'<circle cx="12" cy="12" r="7"/>',
    '⌂':'<path d="m3 11 9-8 9 8m-16-2v11h14V9m-9 11v-6h4v6"/>', '▤':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    '◷':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', '✉':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    '⚙':'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .3 2l-1.7 1.7a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1.1 1.6h-2.4a1.8 1.8 0 0 0-1.1-1.6 1.8 1.8 0 0 0-2 .3l-1.7-1.7a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.6-1.1v-2.4a1.8 1.8 0 0 0 1.6-1.1 1.8 1.8 0 0 0-.3-2l1.7-1.7a1.8 1.8 0 0 0 2 .3 1.8 1.8 0 0 0 1.1-1.6h2.4a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.3l1.7 1.7a1.8 1.8 0 0 0-.3 2 1.8 1.8 0 0 0 1.6 1.1v2.4a1.8 1.8 0 0 0-1.6 1.1Z"/>',
    '↗':'<path d="M7 17 17 7M8 7h9v9"/>', '⬇':'<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>', '→':'<path d="M4 12h15m-6-6 6 6-6 6"/>', '✓':'<path d="m5 12 4 4L19 6"/>', '✎':'<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13 6 4 4"/>', '＋':'<path d="M12 5v14M5 12h14"/>',
    '⏱':'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6m-3 0v3"/>',
    '🔔':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    '🧑':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    '🏫':'<path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M8 21v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/>'
  };
  const tokens=Object.keys(paths).sort((a,b)=>b.length-a.length);
  const matcher=new RegExp(tokens.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\uFE0F?').join('|'),'gu');
  window.iconify=(root)=>{
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      matcher.lastIndex=0;
      const value=node.nodeValue;
      if(!matcher.test(value)){matcher.lastIndex=0;continue;}
      matcher.lastIndex=0;const frag=document.createDocumentFragment();let last=0,m;
      while((m=matcher.exec(value))){
        if(m.index>last)frag.append(document.createTextNode(value.slice(last,m.index)));
        const span=document.createElement('span');span.className='vector-wrap';span.innerHTML=`<svg class="vector-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[m[0].replace(/\uFE0F/g,'')]||'<circle cx="12" cy="12" r="8"/>'}</svg>`;
        frag.append(span);last=m.index+m[0].length;
      }
      if(last<value.length)frag.append(document.createTextNode(value.slice(last)));
      node.parentNode.replaceChild(frag,node);
    }
  };
})();
