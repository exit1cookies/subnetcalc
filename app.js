(function() {
  // Utility functions
  function intToIP(n) {
    return [(n>>>24)&255, (n>>>16)&255, (n>>>8)&255, n&255].join('.');
  }
  function ipToInt(o) {
    return ((o[0]<<24)|(o[1]<<16)|(o[2]<<8)|o[3])>>>0;
  }
  function parseIP(s) {
    var p = s.trim().split('.');
    if (p.length !== 4) return null;
    var n = [];
    for (var i = 0; i < 4; i++) {
      var v = parseInt(p[i], 10);
      if (isNaN(v) || v < 0 || v > 255) return null;
      n.push(v);
    }
    return n;
  }
  function detectClass(f) {
    if (f < 128) return 'A';
    if (f < 192) return 'B';
    return 'C';
  }
  function getDefaultCIDR(cls) {
    if (cls === 'A') return 8;
    if (cls === 'B') return 16;
    return 24;
  }
  function detectIPType(o) {
    var a = o[0], b = o[1];
    if (a === 127) return {label: 'Loopback', color: '#fef3c7', text: '#92400e', tip: 'RFC 1122 - 127.0.0.0/8 reserved for loopback testing'};
    if (a === 10) return {label: 'Private', color: '#dcfce7', text: '#166534', tip: 'RFC 1918 - 10.0.0.0/8 private address space'};
    if (a === 172 && b >= 16 && b <= 31) return {label: 'Private', color: '#dcfce7', text: '#166534', tip: 'RFC 1918 - 172.16.0.0/12 private address space'};
    if (a === 192 && b === 168) return {label: 'Private', color: '#dcfce7', text: '#166534', tip: 'RFC 1918 - 192.168.0.0/16 private address space'};
    if (a === 169 && b === 254) return {label: 'APIPA', color: '#fce7f3', text: '#9d174d', tip: 'RFC 3927 - 169.254.0.0/16 link-local automatic addressing'};
    return {label: 'Public', color: '#dbeafe', text: '#1e40af', tip: 'Publicly routable IP address'};
  }

  // DOM elements
  var ipInput = document.getElementById('ipInput');
  var classSelect = document.getElementById('classSelect');
  var cidrGroup = document.getElementById('cidrGroup');
  var cidrInput = document.getElementById('cidrInput');
  var autoDetect = document.getElementById('autoDetect');
  var errorMsg = document.getElementById('errorMsg');
  var resultsDiv = document.getElementById('results');
  var calcBtn = document.getElementById('calcBtn');
  var lastCalc = null;

  // Populate cheat sheet
  var cheatBody = document.getElementById('cheatBody');
  var rows = '';
  for (var c = 30; c >= 8; c--) {
    var m = (0xFFFFFFFF << (32 - c)) >>> 0;
    var w = (~m) >>> 0;
    var t = Math.pow(2, 32 - c);
    rows += '<tr>';
    rows += '<td style="padding:.4rem .6rem;border-bottom:1px solid #1e3a5f;font-family:monospace;color:#e2e8f0">/' + c + '</td>';
    rows += '<td style="padding:.4rem .6rem;border-bottom:1px solid #1e3a5f;font-family:monospace;color:#e2e8f0">' + intToIP(m) + '</td>';
    rows += '<td style="padding:.4rem .6rem;border-bottom:1px solid #1e3a5f;font-family:monospace;color:#e2e8f0">' + intToIP(w) + '</td>';
    rows += '<td style="padding:.4rem .6rem;border-bottom:1px solid #1e3a5f;font-family:monospace;color:#e2e8f0">' + t.toLocaleString() + '</td>';
    rows += '<td style="padding:.4rem .6rem;border-bottom:1px solid #1e3a5f;font-family:monospace;color:#e2e8f0">' + Math.max(0, t - 2).toLocaleString() + '</td>';
    rows += '</tr>';
  }
  cheatBody.innerHTML = rows;

  // Auto-detect class from IP
  ipInput.addEventListener('input', function() {
    var octets = parseIP(ipInput.value);
    if (octets) {
      var cls = detectClass(octets[0]);
      autoDetect.textContent = '(detected: Class ' + cls + ')';
      classSelect.value = cls;
      cidrGroup.style.display = 'none';
    } else {
      autoDetect.textContent = '';
    }
  });

  classSelect.addEventListener('change', function() {
    autoDetect.textContent = '';
    cidrGroup.style.display = (classSelect.value === 'custom') ? '' : 'none';
  });

  // Show error
  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
    resultsDiv.style.display = 'none';
  }

  // Binary string builder
  function toBinOctets(n) {
    var parts = [(n>>>24)&255, (n>>>16)&255, (n>>>8)&255, n&255];
    var result = [];
    for (var i = 0; i < 4; i++) {
      result.push(parts[i].toString(2).padStart(8, '0'));
    }
    return result;
  }

  function colorBinary(n, cidr) {
    var octets = toBinOctets(n);
    var all = octets.join('');
    var html = '';
    for (var i = 0; i < 32; i++) {
      if (i > 0 && i % 8 === 0) html += '<span style="color:#94a3b8">.</span>';
      if (i < cidr) {
        html += '<span style="color:#2563eb;font-weight:700">' + all.charAt(i) + '</span>';
      } else {
        html += '<span style="color:#0ea5e9">' + all.charAt(i) + '</span>';
      }
    }
    return html;
  }

  function binRowHTML(label, val, cidr) {
    return '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.4rem;font-size:.82rem">' +
      '<span style="width:120px;font-weight:600;color:#94a3b8;flex-shrink:0">' + label + '</span>' +
      '<span style="font-family:monospace;letter-spacing:.5px">' + colorBinary(val, cidr) + '</span>' +
      '</div>';
  }

  // Result card builder
  function makeCard(label, value, tipText) {
    var card = document.createElement('div');
    card.style.cssText = 'background:linear-gradient(135deg,#162d4a,#1e3a5f);border:1px solid #2a4a6d;border-radius:12px;padding:1rem 1.15rem;position:relative;cursor:default;';

    var lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:.75rem;text-transform:uppercase;letter-spacing:.5px;color:#94a3b8;margin-bottom:.3rem;';
    lbl.textContent = label;

    var val = document.createElement('div');
    val.style.cssText = 'font-size:1.05rem;font-weight:700;color:#e2e8f0;word-break:break-all;';
    val.className = 'ri-value';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'position:absolute;top:.5rem;right:.5rem;background:none;border:none;cursor:pointer;opacity:0;font-size:.7rem;color:#94a3b8;padding:3px 6px;border-radius:4px;transition:opacity .2s;';

    var tip = document.createElement('div');
    tip.style.cssText = 'display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1e293b;color:#e2e8f0;font-size:.78rem;line-height:1.5;padding:.75rem 1rem;border-radius:10px;width:300px;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:pre-wrap;';
    tip.textContent = tipText;

    card.appendChild(copyBtn);
    card.appendChild(lbl);
    card.appendChild(val);
    card.appendChild(tip);

    card.addEventListener('mouseenter', function() {
      tip.style.display = 'block';
      copyBtn.style.opacity = '1';
    });
    card.addEventListener('mouseleave', function() {
      tip.style.display = 'none';
      copyBtn.style.opacity = '0';
    });

    copyBtn.addEventListener('click', function() {
      var text = val.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = 'Copied!';
          copyBtn.style.color = '#16a34a';
          copyBtn.style.opacity = '1';
          setTimeout(function() {
            copyBtn.textContent = 'Copy';
            copyBtn.style.color = '#94a3b8';
          }, 1200);
        });
      }
    });

    return { card: card, valEl: val };
  }

  // CALCULATE
  function calculate() {
    try {
      errorMsg.style.display = 'none';
      var octets = parseIP(ipInput.value);
      if (!octets) { showError('Enter a valid IPv4 address (e.g. 192.168.1.0)'); return; }

      var cidr;
      if (classSelect.value === 'custom') {
        cidr = parseInt(cidrInput.value, 10);
        if (isNaN(cidr) || cidr < 1 || cidr > 30) { showError('CIDR must be between 1 and 30'); return; }
      } else {
        cidr = getDefaultCIDR(classSelect.value);
      }

      var ipInt = ipToInt(octets);
      var maskInt = (0xFFFFFFFF << (32 - cidr)) >>> 0;
      var wcInt = (~maskInt) >>> 0;
      var netInt = (ipInt & maskInt) >>> 0;
      var bcastInt = (netInt | wcInt) >>> 0;
      var firstInt = (netInt + 1) >>> 0;
      var lastInt = (bcastInt - 1) >>> 0;
      var total = Math.pow(2, 32 - cidr);
      var usable = Math.max(0, total - 2);

      var netIP = intToIP(netInt);
      var bcastIP = intToIP(bcastInt);
      var maskIP = intToIP(maskInt);
      var wcIP = intToIP(wcInt);
      var firstIP = intToIP(firstInt);
      var lastIP = intToIP(lastInt);
      var cls = detectClass(octets[0]);
      var ipType = detectIPType(octets);

      lastCalc = { networkInt: netInt, cidr: cidr, totalHosts: total };

      // Build result grid using DOM
      var grid = document.getElementById('resultGrid');
      grid.innerHTML = '';
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;';

      var binIP = toBinOctets(ipInt).join('.');
      var binMask = toBinOctets(maskInt).join('.');
      var binNet = toBinOctets(netInt).join('.');
      var binWc = toBinOctets(wcInt).join('.');
      var binFirst = toBinOctets(firstInt).join('.');
      var binLast = toBinOctets(lastInt).join('.');
      var binBcast = toBinOctets(bcastInt).join('.');

      var items = [
        ['Network Address', netIP, 'AND the IP with the subnet mask.\nAll host bits become 0.\n\n' + binIP + ' AND\n' + binMask + ' =\n' + binNet],
        ['Broadcast Address', bcastIP, 'Last address in subnet.\nAll host bits set to 1.\n\n' + binBcast],
        ['Subnet Mask', maskIP, '/' + cidr + ' means first ' + cidr + ' bits are 1 (network),\nremaining ' + (32-cidr) + ' bits are 0 (host).\n\n' + binMask],
        ['Wildcard Mask', wcIP, 'Inverse of subnet mask. Used in ACLs.\n\n' + binWc],
        ['First Usable Host', firstIP, 'Network address + 1\n\n' + binFirst],
        ['Last Usable Host', lastIP, 'Broadcast address - 1\n\n' + binLast],
        ['Usable Hosts', usable.toLocaleString(), '2^' + (32-cidr) + ' = ' + total.toLocaleString() + ' total addresses\nMinus 2 (network + broadcast) = ' + usable.toLocaleString()],
        ['Network Class', 'Class ' + cls, cls === 'A' ? 'Class A: 1-126.x.x.x, default /8' : cls === 'B' ? 'Class B: 128-191.x.x.x, default /16' : 'Class C: 192-223.x.x.x, default /24'],
        ['CIDR Notation', netIP + '/' + cidr, '/' + cidr + ' = ' + cidr + ' network bits, ' + (32-cidr) + ' host bits']
      ];

      for (var i = 0; i < items.length; i++) {
        var r = makeCard(items[i][0], items[i][1], items[i][2]);
        r.valEl.textContent = items[i][1];
        grid.appendChild(r.card);
      }

      // IP Type badge card (special)
      var ipTypeCard = makeCard('IP Type', ipType.label, ipType.tip);
      var badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;padding:.2rem .6rem;border-radius:20px;font-size:.72rem;font-weight:600;background:' + ipType.color + ';color:' + ipType.text + ';';
      badge.textContent = ipType.label;
      ipTypeCard.valEl.textContent = '';
      ipTypeCard.valEl.appendChild(badge);
      grid.appendChild(ipTypeCard.card);

      // Visual address bar
      var barDiv = document.getElementById('visualBar');
      barDiv.innerHTML = '';
      var barContainer = document.createElement('div');
      barContainer.style.cssText = 'background:#0f2035;border:1px solid #2a4a6d;border-radius:12px;height:44px;display:flex;overflow:hidden;';

      var netSeg = document.createElement('div');
      netSeg.style.cssText = 'width:3%;min-width:30px;background:linear-gradient(135deg,#2563eb,#1d4ed8);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700;';
      netSeg.textContent = 'Net';

      var hostSeg = document.createElement('div');
      hostSeg.style.cssText = 'flex:1;background:linear-gradient(135deg,#0ea5e9,#0284c7);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;font-weight:700;';
      hostSeg.textContent = usable.toLocaleString() + ' Hosts';

      var bcastSeg = document.createElement('div');
      bcastSeg.style.cssText = 'width:3%;min-width:40px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700;';
      bcastSeg.textContent = 'Bcast';

      barContainer.appendChild(netSeg);
      barContainer.appendChild(hostSeg);
      barContainer.appendChild(bcastSeg);
      barDiv.appendChild(barContainer);

      // Legend
      var legend = document.createElement('div');
      legend.style.cssText = 'display:flex;gap:1.5rem;margin-top:.5rem;font-size:.75rem;color:#94a3b8;';
      legend.innerHTML = '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#2563eb;margin-right:4px"></span>Network</span>' +
        '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#0ea5e9;margin-right:4px"></span>Usable Hosts</span>' +
        '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#6366f1;margin-right:4px"></span>Broadcast</span>';
      barDiv.appendChild(legend);

      // Binary breakdown
      var binSection = document.getElementById('binarySection');
      binSection.innerHTML = '';
      binSection.style.cssText = 'background:#0f2035;border:1px solid #2a4a6d;border-radius:12px;padding:1.15rem;';
      var binTitle = document.createElement('div');
      binTitle.style.cssText = 'font-size:.95rem;font-weight:700;color:#93c5fd;margin-bottom:.75rem;';
      binTitle.textContent = 'Binary Breakdown';
      binSection.appendChild(binTitle);

      var binNote = document.createElement('div');
      binNote.style.cssText = 'font-size:.7rem;color:#94a3b8;margin-bottom:.75rem;';
      binNote.textContent = 'Blue = network bits, Cyan = host bits';
      binSection.appendChild(binNote);

      var binContent = document.createElement('div');
      binContent.innerHTML = binRowHTML('IP Address', ipInt, cidr) +
        binRowHTML('Subnet Mask', maskInt, cidr) +
        binRowHTML('Network', netInt, cidr) +
        binRowHTML('Broadcast', bcastInt, cidr) +
        binRowHTML('First Host', firstInt, cidr) +
        binRowHTML('Last Host', lastInt, cidr);
      binSection.appendChild(binContent);

      // Network topology using pure HTML/CSS divs
      renderTopology(netIP, bcastIP, firstIP, usable, cidr);

      // Splitter section
      renderSplitter();

      resultsDiv.style.display = '';
      resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch(err) {
      showError('Error: ' + err.message);
    }
  }

  // Network topology with pure HTML/CSS divs
  function renderTopology(netIP, bcastIP, firstIP, usable, cidr) {
    var section = document.getElementById('topologySection');
    section.innerHTML = '';
    section.style.cssText = 'background:#0f2035;border:1px solid #2a4a6d;border-radius:12px;padding:1.15rem;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:.95rem;font-weight:700;color:#93c5fd;margin-bottom:1rem;text-align:center;';
    title.textContent = 'Network Topology';
    section.appendChild(title);

    // Gateway box
    var gwRow = document.createElement('div');
    gwRow.style.cssText = 'display:flex;justify-content:center;margin-bottom:.25rem;';
    var gw = document.createElement('div');
    gw.style.cssText = 'background:linear-gradient(135deg,#2563eb,#1e40af);color:#fff;padding:.6rem 1.5rem;border-radius:10px;text-align:center;min-width:140px;';
    var gwLabel = document.createElement('div');
    gwLabel.style.cssText = 'font-size:.75rem;font-weight:700;';
    gwLabel.textContent = 'Gateway';
    var gwAddr = document.createElement('div');
    gwAddr.style.cssText = 'font-size:.7rem;opacity:.85;margin-top:.15rem;font-family:monospace;';
    gwAddr.textContent = netIP + '/' + cidr;
    gw.appendChild(gwLabel);
    gw.appendChild(gwAddr);
    gwRow.appendChild(gw);
    section.appendChild(gwRow);

    // Vertical connector
    var conn1 = document.createElement('div');
    conn1.style.cssText = 'width:2px;height:24px;background:#3b82f6;margin:0 auto;';
    section.appendChild(conn1);

    // Network segment bar
    var segRow = document.createElement('div');
    segRow.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;';
    var segLeft = document.createElement('div');
    segLeft.style.cssText = 'font-size:.65rem;color:#2563eb;font-weight:600;font-family:monospace;white-space:nowrap;';
    segLeft.textContent = firstIP;
    var segBar = document.createElement('div');
    segBar.style.cssText = 'flex:1;height:20px;background:#162d4a;border:1px solid #2a4a6d;border-radius:6px;display:flex;align-items:center;justify-content:center;';
    var segLabel = document.createElement('span');
    segLabel.style.cssText = 'font-size:.65rem;font-weight:600;color:#94a3b8;';
    segLabel.textContent = 'NETWORK SEGMENT';
    segBar.appendChild(segLabel);
    var segRight = document.createElement('div');
    segRight.style.cssText = 'font-size:.65rem;color:#6366f1;font-weight:600;font-family:monospace;white-space:nowrap;';
    segRight.textContent = bcastIP;
    segRow.appendChild(segLeft);
    segRow.appendChild(segBar);
    segRow.appendChild(segRight);
    section.appendChild(segRow);

    // Host nodes
    var cnt = Math.min(usable, 5);
    var hasMore = usable > 5;
    var hostRow = document.createElement('div');
    hostRow.style.cssText = 'display:flex;justify-content:center;gap:1rem;flex-wrap:wrap;margin-top:.5rem;';

    var fOctets = parseIP(firstIP);
    for (var i = 0; i < cnt; i++) {
      var hostWrap = document.createElement('div');
      hostWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';

      var vline = document.createElement('div');
      vline.style.cssText = 'width:1.5px;height:16px;background:#3b82f6;';
      hostWrap.appendChild(vline);

      var hostBox = document.createElement('div');
      hostBox.style.cssText = 'background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;padding:.5rem .75rem;border-radius:8px;text-align:center;min-width:90px;';
      var hLabel = document.createElement('div');
      hLabel.style.cssText = 'font-size:.7rem;font-weight:600;';
      hLabel.textContent = 'Host ' + (i + 1);
      var hAddr = document.createElement('div');
      hAddr.style.cssText = 'font-size:.62rem;opacity:.85;margin-top:.1rem;font-family:monospace;';
      if (fOctets) {
        var ho = fOctets.slice();
        ho[3] = ho[3] + i;
        hAddr.textContent = ho.join('.');
      }
      hostBox.appendChild(hLabel);
      hostBox.appendChild(hAddr);
      hostWrap.appendChild(hostBox);
      hostRow.appendChild(hostWrap);
    }

    if (hasMore) {
      var moreWrap = document.createElement('div');
      moreWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
      var mLine = document.createElement('div');
      mLine.style.cssText = 'width:1.5px;height:16px;background:#3b82f6;';
      moreWrap.appendChild(mLine);
      var moreBox = document.createElement('div');
      moreBox.style.cssText = 'background:#162d4a;border:2px dashed #2a4a6d;color:#94a3b8;padding:.5rem .75rem;border-radius:8px;text-align:center;min-width:90px;';
      var mLabel = document.createElement('div');
      mLabel.style.cssText = 'font-size:1.1rem;font-weight:700;';
      mLabel.textContent = '...';
      var mCount = document.createElement('div');
      mCount.style.cssText = 'font-size:.62rem;margin-top:.1rem;';
      mCount.textContent = '+' + (usable - 5).toLocaleString() + ' more';
      moreBox.appendChild(mLabel);
      moreBox.appendChild(mCount);
      moreWrap.appendChild(moreBox);
      hostRow.appendChild(moreWrap);
    }

    section.appendChild(hostRow);
  }

  // Subnet splitter
  function renderSplitter() {
    var section = document.getElementById('splitterSection');
    section.innerHTML = '';
    section.style.cssText = 'background:#0f2035;border:1px solid #2a4a6d;border-radius:12px;padding:1.15rem;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:.95rem;font-weight:700;color:#93c5fd;margin-bottom:.75rem;';
    title.textContent = 'Subnet Splitter (VLSM)';
    section.appendChild(title);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;';

    var lbl1 = document.createElement('span');
    lbl1.style.cssText = 'font-size:.82rem;color:#94a3b8;';
    lbl1.textContent = 'Split into';

    var splitInput = document.createElement('input');
    splitInput.type = 'number';
    splitInput.min = '2';
    splitInput.max = '256';
    splitInput.value = '4';
    splitInput.id = 'splitCount';
    splitInput.style.cssText = 'width:80px;padding:.5rem .75rem;border:1.5px solid #2a4a6d;border-radius:8px;font-size:.9rem;outline:none;background:#162d4a;color:#e2e8f0;';

    var lbl2 = document.createElement('span');
    lbl2.style.cssText = 'font-size:.82rem;color:#94a3b8;';
    lbl2.textContent = 'equal subnets';

    var splitBtn = document.createElement('button');
    splitBtn.textContent = 'Split';
    splitBtn.style.cssText = 'padding:.5rem 1rem;background:linear-gradient(135deg,#2563eb,#1e40af);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;';

    row.appendChild(lbl1);
    row.appendChild(splitInput);
    row.appendChild(lbl2);
    row.appendChild(splitBtn);
    section.appendChild(row);

    var resultsArea = document.createElement('div');
    section.appendChild(resultsArea);

    splitBtn.addEventListener('click', function() {
      if (!lastCalc) { showError('Calculate a subnet first.'); return; }
      var count = parseInt(splitInput.value, 10);
      if (isNaN(count) || count < 2 || count > 256) {
        resultsArea.innerHTML = '<p style="color:#dc2626;font-size:.82rem">Enter a number between 2 and 256.</p>';
        return;
      }
      var bits = Math.ceil(Math.log2(count));
      var nc = lastCalc.cidr + bits;
      if (nc > 30) {
        resultsArea.innerHTML = '<p style="color:#dc2626;font-size:.82rem">Not enough host bits to split into that many subnets.</p>';
        return;
      }
      var actual = Math.pow(2, bits);
      var sz = Math.pow(2, 32 - nc);
      var hostsPer = Math.max(0, sz - 2);

      var h = '<p style="font-size:.78rem;color:#94a3b8;margin-bottom:.75rem">' + actual + ' subnets (/' + nc + '), ' + hostsPer.toLocaleString() + ' hosts each</p>';
      h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.78rem"><thead><tr>';
      var headers = ['#', 'Network', 'First Host', 'Last Host', 'Broadcast', 'Hosts'];
      for (var hi = 0; hi < headers.length; hi++) {
        h += '<th style="background:linear-gradient(135deg,#2563eb,#1e40af);color:#fff;padding:.5rem .6rem;text-align:left;font-size:.7rem;text-transform:uppercase">' + headers[hi] + '</th>';
      }
      h += '</tr></thead><tbody>';
      for (var i = 0; i < actual; i++) {
        var n = (lastCalc.networkInt + i * sz) >>> 0;
        var b = (n + sz - 1) >>> 0;
        var rowBg = (i % 2 === 1) ? 'background:#162d4a;' : '';
        var td = 'padding:.4rem .6rem;border-bottom:1px solid #2a4a6d;font-family:monospace;color:#e2e8f0;' + rowBg;
        h += '<tr>';
        h += '<td style="' + td + '">' + (i + 1) + '</td>';
        h += '<td style="' + td + '">' + intToIP(n) + '/' + nc + '</td>';
        h += '<td style="' + td + '">' + intToIP(n + 1) + '</td>';
        h += '<td style="' + td + '">' + intToIP(b - 1) + '</td>';
        h += '<td style="' + td + '">' + intToIP(b) + '</td>';
        h += '<td style="' + td + '">' + hostsPer.toLocaleString() + '</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      resultsArea.innerHTML = h;
    });
  }

  // Wire up events
  calcBtn.addEventListener('click', calculate);
  ipInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') calculate();
  });

})();
