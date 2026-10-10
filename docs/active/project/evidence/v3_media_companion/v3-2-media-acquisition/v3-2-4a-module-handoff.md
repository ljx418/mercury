# V3-2-4a Module Handoff

## Module

Module: V3 Media Companion acquisition orchestration / trusted tab capture / SenseVoice fallback  
Owner Agent: Codex implementation session  
Date: 2026-10-07  
Stage Gate: V3-2-4a independent implementation exit audit

## Change Summary

Changed files: Runtime acquisition/capture/ASR modules and API; extension acquisition/capture modules, Background, Offscreen, Side Panel/Workspace integration; tests and real Chrome runner.  
Behavior added: same-task ordered acquisition, two-step trusted tab capture, non-silent PCM validation, thread-safe sandboxed SenseVoice execution, cleanup and public secret evidence.  
Behavior intentionally not added: other portal adapters, V3-2-5+, V3-3+, background capture, arbitrary model/tool selection.

## Contract Status

Public API changed: yes, V3 media acquisition/capture endpoints only.  
Adapter contract changed: yes, V3 portal/acquirer boundary only.  
Data model changed: yes, capture receipt includes acoustic statistics.  
Event type changed: no V1.2 event change.  
V1.2-0 review path: not applicable; no V1 A/B/C/D contract edited.

## Evidence

Unit/contract tests run: Runtime 561; Frontend 307; typecheck/build exit 0.  
Real data and Chrome evidence: `v3-2-4a-real-chrome/runs/v3-2-4a-20261007T074401Z/`.  
Trace evidence: private Runtime log and public result bound to the same run.

## PRD Coverage

Covered: V3-2 acquisition orchestration through trusted capture and local transcript fallback.  
Not covered: V3-2-5..7 and all later V3 stages.  
Reason: stage-gated implementation and independent review remain required.

## Integration Handoff

Inputs: registered portal context, same-task credential lease, frozen SenseVoice assets, active user-selected tab.  
Outputs: Runtime acquisition/task receipts and transcript terminal receipt.  
Known risks: platform drift; one-page evidence; historical failed private diagnostic runs.  
Stop conditions: any secret/public residue, silent capture, identity mismatch, automatic capture, nonterminal transcript represented as success.
