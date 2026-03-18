# Technical Graph Skeleton

> Macro technical memory backbone. Keep it stable and update incrementally.

## Entities

- Module
- Service
- API
- DataStore
- TechDecision

## Relations

- depends_on
- implements
- owns_data
- affects
- supersedes

## Current System Map

- Loom MCP Server -> depends_on -> Weaver Logic
- Weaver Logic -> depends_on -> Git Sync
- Loom MCP Server -> exposes -> loom_weave / loom_trace / loom_index / loom_probe_start / loom_probe_commit

## Update Rule

- When adding a new core capability, append one node and at least one edge.
