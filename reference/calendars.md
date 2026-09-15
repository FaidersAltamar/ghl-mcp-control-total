# Calendarios — Control Ads

Location: `kNcygEmVTrhIueZQMDXM`  
Última auditoría: 2026-09-01

## Oficiales (producción)

| Canal | Nombre GHL | ID | URL |
|---|---|---|---|
| Meta (FB/IG) | Meta Ads - Llamada Estrategica | `bJT5h32OkoOdSfV2zd4O` | https://link.dropi.co/widget/booking/bJT5h32OkoOdSfV2zd4O |
| TikTok | TikTok Ads - Llamada Estrategica | `o6c2SOIoEkjEfKtBPUNN` | https://link.dropi.co/widget/booking/o6c2SOIoEkjEfKtBPUNN |

- Grupo: **Done For You** (`scalesoftn`)
- Equipo: Faiders Altamar + Fabian Hoyos (round robin, 30 min)
- Slugs: `doneforyou/faecbookn`, `doneforyou/tiktokn`

## Activos secundarios

| Nombre | ID | URL | Notas |
|---|---|---|---|
| Contingencias facebook | `JGiNpYTCf6w3BwpAdChw` | https://link.dropi.co/widget/booking/JGiNpYTCf6w3BwpAdChw | Solo Faiders. Emails OK (inmediatos). |
| PLATAFORMA FÁCIL | `aNe8lSP8SaiCKGLqRAhH` | https://link.dropi.co/widget/booking/aNe8lSP8SaiCKGLqRAhH | Álvaro Gutiérrez. Emails con delay 10 min. |
| faider altamar's Personal | `rwD6kaOl5evRDEvnVcGY` | https://link.dropi.co/widget/booking/rwD6kaOl5evRDEvnVcGY | Personal. Sin emails. |

## Desactivados (huérfanos — 2026-09-01)

| Nombre | ID | Motivo |
|---|---|---|
| contingencias | `bjiLn57ccGDzOylXMoUT` | Duplicado de Contingencias facebook |
| Contingencias TikTok | `2vVaqq8c1uZ2xSpXW6Cr` | 0 citas, duplicado TikTok oficial |
| nuevo | `j8amkbGOOY5fRVrrdPuF` | Duplicado slug `doneforyou/tiktok` |
| Scalesoft | `hP8SgNFMwUKcLZpgewI2` | Sin equipo, slots 1 min |
| Scalesoft Nor | `udEMrWtLj56RbaNqgLtG` | Ya inactivo, sin equipo |
| moreno don bm | `9iC6NCqxT7tgQJfT3zJE` | 0 citas |
| LM Personal Calendar | `gdMW5gzKhfMFTK7Mcuc3` | Duplicado PLATAFORMA FÁCIL |
| Conéctate con RUSH | `qSuATyE5ul1V3eqd19bn` | Test, 0 citas |
| FABI EL BEBE's Personal | `mc7RyRFMg1WfnGoWKQN3` | Personal sin uso |

## Scripts

```bash
node scripts/calendars/audit.mjs
node scripts/calendars/deactivate-orphans.mjs --dry-run
```

## Emails (oficiales)

Meta Ads y TikTok Ads tienen 6 notificaciones email inmediatas cada uno (booked + confirmation → contact, assignedUser, emails admin).

Admin copy: `faiders@scale.com.co`, `soft@scale.com.co`
