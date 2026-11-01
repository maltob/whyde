export interface ProbeResult {
  capability: string;
  status: 'pass' | 'fail' | 'optional-unsupported';
  details: string;
}

export async function probeCapabilities(): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  // 1. WebAssembly
  const wasmSupported = typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
  results.push({
    capability: 'WebAssembly Support',
    status: wasmSupported ? 'pass' : 'fail',
    details: wasmSupported ? 'WebAssembly core & instantiate ready' : 'WebAssembly missing',
  });

  // 2. Web Workers
  const workerSupported = typeof Worker !== 'undefined';
  results.push({
    capability: 'Dedicated Web Workers',
    status: workerSupported ? 'pass' : 'fail',
    details: workerSupported ? 'Worker available' : 'Web Workers unavailable',
  });

  // 3. IndexedDB
  const idbSupported = typeof indexedDB !== 'undefined';
  results.push({
    capability: 'IndexedDB Storage',
    status: idbSupported ? 'pass' : 'fail',
    details: idbSupported ? 'IndexedDB available for VFS' : 'IndexedDB unavailable',
  });

  // 4. SharedArrayBuffer & Cross-Origin Isolation
  const crossOriginIsolated = typeof window !== 'undefined' && (window as any).crossOriginIsolated === true;
  const sabSupported = typeof SharedArrayBuffer !== 'undefined';
  results.push({
    capability: 'SharedArrayBuffer (Optional)',
    status: crossOriginIsolated && sabSupported ? 'pass' : 'optional-unsupported',
    details: crossOriginIsolated
      ? 'COOP/COEP headers present; SAB enabled'
      : 'COOP/COEP not enabled (standard for GitHub Pages). Non-SAB async stdin baseline active.',
  });

  // 5. OPFS
  const opfsSupported = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
  results.push({
    capability: 'OPFS (Origin Private File System)',
    status: opfsSupported ? 'pass' : 'optional-unsupported',
    details: opfsSupported ? 'OPFS supported for high-perf compiler caching' : 'OPFS unsupported; fallback to IndexedDB',
  });

  // 6. Web Crypto
  const cryptoSupported = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  results.push({
    capability: 'Web Crypto API',
    status: cryptoSupported ? 'pass' : 'fail',
    details: cryptoSupported ? 'SHA-256 integrity verification ready' : 'Web Crypto unavailable',
  });

  return results;
}

if (typeof document !== 'undefined') {
  probeCapabilities().then((results) => {
    const tbody = document.getElementById('results-body');
    if (tbody) {
      tbody.innerHTML = '';
      for (const res of results) {
        const tr = document.createElement('tr');
        const statusClass = res.status === 'pass' ? 'pass' : 'note';
        tr.innerHTML = `
          <td><strong>${res.capability}</strong></td>
          <td class="${statusClass}">${res.status.toUpperCase()}</td>
          <td>${res.details}</td>
        `;
        tbody.appendChild(tr);
      }
    }
  });
}
