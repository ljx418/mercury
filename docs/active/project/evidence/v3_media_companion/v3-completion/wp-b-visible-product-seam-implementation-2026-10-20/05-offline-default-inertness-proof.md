# The default and the offline invocation are inert

## The default invocation

```
$ node e2e/v3-wp-b-local-import-owned-session.mjs
{"schemaVersion":"v3-wp-b-visible-session-offline/v1","phase":"offline","launched":false,
 "generatedAssets":0,"cases":[…]}
```

`runOffline()` builds the plan, proves it is complete, writes its receipt and
removes its own owned root. It never touches the process, network or browser
adapters, so it cannot start a Runtime, launch Chrome or generate an asset.

## The visible phase without the approval

```
$ NAVIA_WP_B_SESSION_PHASE=visible-run node e2e/v3-wp-b-local-import-owned-session.mjs
… A visible session needs NAVIA_WP_B_VISIBLE_APPROVED=1. Nothing was launched.
```

The refusal happens in `main()`, BEFORE the owned root is created, before the
preflight and before any adapter is touched.

## The preflight refuses before Chrome

Even with the approval, the preflight runs first and refuses with a precise
`EXTERNAL-INPUT BLOCK` when any of these is missing:

* the authorized seed (`NAVIA_WP_B_SEED_MEDIA`);
* a free CDP port and a free Runtime port;
* the owned Chrome executable;
* the built extension root;
* the free disk (at least the frozen 4 GiB);
* the product's own ffmpeg/ffprobe configuration;
* the four target Bilibili identities, each an http(s) URL on a Bilibili host;
* the explicitly supplied cookie file.

## The counts of this pass

| kind | count |
|---|---|
| Chrome launched (visible) | **0** |
| Chrome launched (headless) | **0** |
| Runtime started | **0** |
| 100 MB / 1 GB asset generated | **0** |
| visible windows opened | **0** |
| focus events | **0** |
| audio playback | **0** |
| B27 / B29 / B30 executed | **0** |
| the single approved visible session consumed | **no** |

The offline tests assert the same facts against the production runner
composition: the default invocation launches zero Runtime and zero Chrome and
generates zero large assets.
