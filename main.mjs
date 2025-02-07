import integrityData from "./integrity.json" with { type: "json" };

const defaultUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";
const targets = new Set([
  "es2015",
  "es2016",
  "es2017",
  "es2018",
  "es2019",
  "es2020",
  "es2021",
  "es2022",
  "es2023",
  "es2024",
  "esnext",
  "deno",
  "denonext",
  "node",
]);

async function checkWebsite() {
  const res = await fetchEsmsh("https://esm.sh");
  if (res.headers.get("content-type") !== "text/html; charset=utf-8") {
    throw new Error("Invalid content type");
  }
  const html = await res.text();
  if (!html.includes("</html>")) {
    throw new Error("Bad HTML");
  }
}

async function checkServerStatus() {
  const res = await fetchEsmsh("https://esm.sh/status.json?t=" + Date.now().toString(36));
  try {
    const json = await res.json();
    if (json.disk === "error") {
      throw new Error("Disk error");
    }
    if (json.disk === "full") {
      throw new Error("Disk full");
    }
    if (!json.uptime) {
      throw new Error("Bad status.json");
    }
  } catch (error) {
    throw new Error("Bad status.json");
  }
}

async function checkModules() {
  for (const item of integrityData.list) {
    const url = new URL(item.url);
    if (url.origin !== "https://esm.sh") {
      throw new Error(`Invalid origin: ${url.origin}`);
    }
    if (!/@\d+\.\d+\.\d+/.test(url.pathname)) {
      throw new Error(`Exact version required: ${url.pathname}`);
    }
    if (item.target) {
      if (!targets.has(item.target)) {
        throw new Error(`Invalid target: ${item.target}`);
      }
      url.searchParams.set("target", item.target);
    }
    const res = await fetchEsmsh(url, item.userAgent);
    const [argorithm, hash] = item.integrity.split("-", 2);
    if (!/^sha\d+$/i.test(argorithm)) {
      throw new Error(`Invalid hash algorithm: ${argorithm}`);
    }
    const buf = await crypto.subtle.digest("SHA-" + argorithm.slice(3), await res.arrayBuffer());
    const digest = Array.from(new Uint8Array(buf))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== hash) {
      throw new Error(`Integrity check failed: ${item.url}, want ${hash}, got ${digest}`);
    }
  }
}

async function fetchEsmsh(url, userAgent) {
  const doFetch = () =>
    new Promise((resolve, reject) => {
      const ac = new AbortController();
      setTimeout(() => {
        ac.abort();
        reject(new Error(`Fetch ${url}: timeout`));
      }, 10000); // 10s
      fetch(url, { headers: { "User-Agent": userAgent ?? defaultUserAgent }, signal: ac.signal }).then(res => {
        if (!res.ok) {
          reject(new Error(`Fetch ${url}: ${res.status}`));
        }
        resolve(res);
      }, reject);
    });
  try {
    return await doFetch();
  } catch (error) {
    // retry once after 500ms
    await new Promise(resolve => setTimeout(resolve, 500));
    return await doFetch();
  }
}

function reportError(monitorType, env) {
  return function(error) {
    console.error(`⚠️ [${monitorType}]`, error.message);
    return error;
  };
}

async function check(env) {
  const errors = await Promise.all([
    checkWebsite().catch(reportError("website", env)),
    checkServerStatus().catch(reportError("server", env)),
    checkModules().catch(reportError("CDN", env)),
  ]);
  return errors.filter(Boolean);
}

if (import.meta.main) {
  const errors = await check(Deno.env.toObject());
  if (errors.length === 0) {
    console.log("✅ All checks passed");
    Deno.exit(0);
  } else {
    Deno.exit(1);
  }
}

export default {
  async scheduled(event, env, ctx) {
    await check(env);
  },
  async fetch(request, env) {
    const errors = await check(env);
    if (errors.length === 0) {
      return new Response("✅ All checks passed", { status: 200 });
    }
    return Response.json({ errors: errors.map(e => e.message) }, { status: 500 });
  },
};
