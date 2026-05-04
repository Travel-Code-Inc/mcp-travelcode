# Hotel search & booking — client-selection flow

This is the canonical scheme the LLM must follow when chaining
`search_hotels` → `get_hotel_offers` → `create_order` for hotels. The same
ideas apply to flights with minor adjustments (see the bottom of the file).

The flow is driven by two pieces of context: **the caller's role**
(returned by `get_current_user` once per session) and **the search shape**
(1 adult, multi-adult, with or without children).

---

## 0. Always first — `get_current_user`

Call `get_current_user` exactly once at the start of every session and
reuse the result for the rest of the conversation. The role determines the
whole branching below.

| Role                 | Effect on hotel flow                                                                |
|----------------------|-------------------------------------------------------------------------------------|
| `employee_traveller` | Hard-locked to 1 guest. Always reuse the user's only tourist. Minimal questions.    |
| `developer`          | Standard flow + every reply is prefixed with `[Developer mode]`.                    |
| any other role       | Standard flow described in sections 1–4.                                            |

---

## 1. Search-time decision tree

```
                         get_current_user
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
         traveller         developer           other role
              │                 │                  │
              ▼                 ▼                  ▼
      get_first_client    standard flow      ┌─────────────┐
      force adults=1      + [Developer       │ how many    │
      use returned          mode] prefix     │ adults?     │
      nationality                            └──────┬──────┘
              │                                     │
              │                          ┌──────────┴──────────┐
              │                          │                     │
              │                       1 adult            2+ adults
              │                          │                     │
              │                          ▼                     ▼
              │            nationality given by user?     ask only
              │                  │             │          lead-guest
              │                yes            no          nationality
              │                  │             │              │
              │                  ▼             ▼              │
              │            search_hotels  get_first_client    │
              │                            "use Ivan, BY?"    │
              │                            │      │           │
              │                          yes      no          │
              │                            │      │           │
              │                            │      ▼           │
              │                            │ ask only the     │
              │                            │ nationality      │
              │                            │      │           │
              │                            ▼      ▼           ▼
              └─────────────► search_hotels (with country_code)
                                    │
                            children in guests?
                              │            │
                            yes            no
                              │            │
                              ▼            ▼
                       ask exact ages   continue
                       in years; pass
                       to childrenAges
```

**Rules at a glance:**

1. `country_code` (lead-guest nationality) is **mandatory** for
   `search_hotels`. Pricing and availability depend on it, and it is the
   single most-common reason a booking later returns a different rate.
2. The same `country_code` MUST be used as the lead guest's `nationality`
   at `create_order`. Do not change it between search and booking.
3. For 1-adult searches with no nationality, `get_first_client` is the
   short-circuit that lets the user accept their own profile in one tap
   instead of typing details.
4. For multi-adult / family searches, only the lead guest's nationality is
   collected at search time. Full passport details for every guest are
   collected later, before `create_order`.
5. If children are part of the search, ask each child's age in completed
   years up front and pass them in `guests[].childrenAges`. Adults can
   skip age questions at search time.

---

## 2. Booking-time decision tree

```
            user picks a rate from get_hotel_offers
                                │
                                ▼
                         role check
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
         traveller         developer           other role
              │                 │                  │
              ▼                 ▼                  ▼
   confirm only first/   prefix reply with     was a default
   last name; reuse      [Developer mode];     traveler proposed
   tourist from          continue with         at search time?
   get_first_client      standard flow              │
              │                 │              ┌────┴────┐
              │                 │            yes        no
              │                 │              │         │
              │                 │              ▼         ▼
              │                 │         get_client   collect
              │                 │         (id) → fill  passport
              │                 │         lead guest   details
              │                 │              │       for every
              │                 │              │       guest
              │                 │              ▼       (manual or
              │                 │         ask other    search_clients
              │                 │         guests       per name)
              │                 │              │
              └────────┬────────┴──────────────┘
                       ▼
              local validation:
                children ages match search? (expected_children_ages)
                lead nationality == search country_code?
                       │
              ┌────────┴────────┐
              │                 │
            ok               mismatch
              │                 │
              ▼                 ▼
        create_order      tell user the
              │           mismatch and
              ▼           re-search
       201 ok? → done
              │
              ▼
        409 offer_changed
              │
              ▼
        show diff to the user
        (price / cancel policy)
              │
              ▼
        user confirms?
              │
        ┌─────┴─────┐
       yes         no
        │           │
        ▼           ▼
   create_order   stop
   + book_key
        │
        ▼
       done
```

**Validation rules done client-side, before the API call:**

- **Adult age** — search vs booking diff is **not** enforced.
- **Child age** — strict. If `expected_children_ages` is supplied,
  `create_order` computes each child's age at `checkin` and compares to
  the multiset of expected ages. A mismatch fails locally with a clear
  message; the API would otherwise reply `OCCUPANCY_MISMATCH (39)`.
- **Lead-guest nationality** — must equal the `country_code` used in
  search.
- **Dates** — accepted in any common format on input
  (`YYYY-MM-DD`, `DD.MM.YYYY`, ISO datetime, …); MCP normalizes to strict
  `YYYY-MM-DD`. If the date is ambiguous (e.g. `03.04.2026` with no
  locale clue), MCP returns an error and the LLM must re-ask the user.

---

## 3. Role-specific flows

### 3.1 `employee_traveller` (Тревелер)

The traveller has access to exactly one tourist record — themselves.
Booking on behalf of anyone else is impossible by API design.

```
session start
    │
    ▼
get_current_user → role=employee_traveller
    │
    ▼
get_first_client (silent, no question)
    │
    ▼
search_hotels with adults=1, country_code = client.nationality
    │
    ▼
get_hotel_offers → user picks a rate
    │
    ▼
"Бронируем на Ivan Petrov?"   ← only confirm first/last name
    │
    ▼
create_order(service_type='hotel', rooms=[{guests:[client]}])
```

If the user requests 2+ guests, refuse with a clear message: this account
type can book only for itself.

### 3.2 `developer`

Same as standard flow, but every user-facing reply for `search_hotels`,
`get_hotel_offers`, `create_order` (and the corresponding flight tools) is
prefixed with `[Developer mode]` so the user is never in doubt that the
call hit the dev environment / dev account.

### 3.3 Other roles (director, employee, top_manager, …)

Standard flow described in sections 1–2.

---

## 4. Cancellation flow

```
get_order(id)               ← (optional) confirm what is being cancelled
    │
    ▼
check_order_cancellation     ← MANDATORY before cancel_order
    │
    ▼
show penalty / refund / deadline
    │
    ▼
"Подтвердите отмену со штрафом X" ← MANDATORY explicit confirmation
    │
    ▼
cancel_order
    │
    ▼
get_order(id) until status terminal   ← cancellation is async
```

`cancel_order` is idempotent — calling on an already-cancelled order
returns the current status, not an error.

---

## 5. Flights — short delta

- `country_code` is not part of flight search; nationality is collected at
  booking only.
- `employee_traveller` rule is the same: 1 passenger, reuse the only
  tourist, and at booking pick a document — if the tourist has multiple
  entries in `docs[]`, ask which one; otherwise auto-pick.
- 409 `offer_changed` does not occur on flights; only hotel rates.
- Children/infants in flights are bucketed by the tariff (`infant <2`,
  `child 2–11`, `adult ≥12`) — exact-age matching is not required, but
  the booking type (`infant`/`child`/`adult`) must match the search
  counts.

---

## 6. MCP tool surface used by this flow

| Tool                         | Where in the flow                                  |
|------------------------------|----------------------------------------------------|
| `get_current_user`           | once per session, drives all branching             |
| `search_hotel_locations`     | resolve free-text city to a location id            |
| `get_first_client`           | propose / load the user's default tourist          |
| `search_clients` + `get_client` | pick a non-default tourist by name              |
| `search_hotels`              | find offers for a given location and dates         |
| `get_hotel_offers`           | room-level rates for a chosen hotel                |
| `create_order`               | book; supports `book_key` retry on 409             |
| `check_order_cancellation`   | preview the cancellation cost                      |
| `cancel_order`               | execute the cancellation                           |
| `get_order`                  | poll status / inspect a finished order             |
