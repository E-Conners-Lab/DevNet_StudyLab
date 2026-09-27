# Content snapshot and reuse

The final local edition bundles a historical DevNet Associate 200-901 v1.1 study snapshot: six guides, 61 objective entries, 199 flashcards, two 40-question practice exams, and seven labs. These are actual bundled counts, not targets for a future content expansion. No ongoing curriculum maintenance is planned.

Canonical files live in `content/` and are imported by the browser catalog at build time. Content IDs bind local progress and backups to `contentVersion: "2026-09-27"`. A fork that changes identity/meaning must choose and test an explicit content-version migration; unknown backup versions are rejected instead of silently reinterpreted.

The material is independent educational content. It is not official Cisco training, a validated representation of a live certification exam, or a promise of complete coverage. Cisco's current certification is [CCNA Automation](https://www.cisco.com/site/us/en/learn/training-certifications/training/courses/ccnaauto.html). Check its current objectives and official sources before preparing for an exam. External references can move or disappear.

Labs include simulated configuration/CLI exercises. Browser Python can use bundled packages, not arbitrary external APIs or host commands. An exercise describing Git, Docker, Ansible, or a network device does not mean the app provisions that infrastructure. Hints and worked solutions remain available when an exercise needs a separate environment.

Before redistributing modified content, review accuracy, rights and attribution, preserve third-party notices, validate the JSON schemas, and test ordinary learner flows. Do not add confidential configurations, real credentials, proprietary exam dumps, or material you lack permission to distribute. Run the content validation suite from the source tree:

```sh
npm run test:content --prefix apps/web
```
