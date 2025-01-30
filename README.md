# uptime

A uptime monitor for esm.sh CDN.

## Updating the integrity list

To update the integrity list, edit [integrity.json](./integrity.json) file and submit a pull request.

```jsonc
{
  "list": [
    {
      "url": "https://esm.sh/react@19.0.0",
      "integrity": "sha256-...",
      "target": "esnext", // optional
      "userAgent": "Mozilla/5.0 ..." // optional
    }
  ]
}
```

> [!IMPORTANT]
> The `url` field requires an exact package version.
> For example, `https://esm.sh/react@^19.0.0` is not allowed.

## How to get the integrity of an esm.sh module

You can get the integrity of an esm.sh module by running the following command:

```bash
curl https://esm.sh/react@19.0.0 | shasum -a 256
```
