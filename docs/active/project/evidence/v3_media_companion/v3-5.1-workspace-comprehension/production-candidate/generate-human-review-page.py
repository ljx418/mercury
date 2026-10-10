#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RUN = ROOT / "runs" / "v3-5.1-production-candidate-20261010T210000Z"
OUTPUT = ROOT / "human-review" / "index.html"


def load(name: str) -> dict:
    return json.loads((RUN / name).read_text(encoding="utf-8"))


def sha256(name: str) -> str:
    return hashlib.sha256((RUN / name).read_bytes()).hexdigest()


def main() -> None:
    candidates = [load(f"candidate-{index}.json") for index in range(1, 4)]
    hashes = [sha256(f"candidate-{index}.json") for index in range(1, 4)]
    review_data = []
    for candidate_index, candidate in enumerate(candidates, start=1):
        bvid = candidate["task"]["sourceIdentity"].split(":")[2]
        review_data.append({
            "candidateIndex": candidate_index,
            "bvid": bvid,
            "title": candidate["outline"]["title"],
            "taskId": candidate["task"]["taskId"],
            "questions": candidate["askBenchmark"],
        })
    payload = json.dumps(review_data, ensure_ascii=False).replace("</", "<\\/")
    hashes_json = json.dumps(hashes)
    OUTPUT.write_text(f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Navia V3-5.1 固定候选质量复核</title>
<style>
:root{{--ink:#15201e;--muted:#586863;--line:#c7d4d0;--surface:#fff;--wash:#f3f7f6;--accent:#006b5a;--danger:#a43131;--warn:#8a5a00}}*{{box-sizing:border-box}}body{{margin:0;background:#f7faf9;color:var(--ink);font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;letter-spacing:0}}button,input,textarea{{font:inherit}}header{{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);background:#fff}}.bar,main{{width:min(1180px,calc(100% - 28px));margin:auto}}.bar{{padding:15px 0;display:flex;justify-content:space-between;gap:20px;align-items:center}}h1{{margin:0;font-size:22px}}h2{{margin:0 0 8px;font-size:19px}}h3{{margin:0;font-size:16px}}p{{line-height:1.6}}code,.meta,.answer small{{overflow-wrap:anywhere}}.status{{padding:7px 10px;border:1px solid #dfb967;color:#704800;background:#fff8e8;font-weight:800}}main{{padding:24px 0 70px;display:grid;gap:16px;min-width:0}}.intro,.video,.ask,.experience,.export{{min-width:0;border:1px solid var(--line);background:var(--surface);padding:18px;border-radius:6px}}.intro ul{{line-height:1.8}}.video-head{{display:flex;justify-content:space-between;gap:16px;align-items:start;min-width:0}}.video-head>div{{min-width:0}}.meta{{color:var(--muted);font-size:12px}}.ask-grid{{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(280px,1.3fr);gap:18px}}.question{{font-weight:800}}.answer{{padding:10px 12px;border-left:3px solid var(--accent);background:var(--wash);margin:8px 0;overflow-wrap:anywhere}}.answer small{{display:block;color:var(--muted);margin-top:4px}}fieldset{{border:0;padding:0;margin:14px 0 0}}legend{{font-weight:800;margin-bottom:8px}}.choices{{display:flex;flex-wrap:wrap;gap:8px}}.choices label{{position:relative}}.choices input{{position:absolute;opacity:0}}.choices span{{display:block;border:1px solid var(--line);padding:8px 11px;cursor:pointer;font-weight:700}}.choices input:checked+span{{background:var(--accent);border-color:var(--accent);color:#fff}}.choices input[value="bad"]:checked+span,.choices input[value="FAIL"]:checked+span{{background:var(--danger);border-color:var(--danger)}}.choices input[value="BLOCKED"]:checked+span{{background:var(--warn);border-color:var(--warn)}}textarea,input[type=text]{{width:100%;padding:9px;border:1px solid var(--line);margin-top:9px}}textarea{{min-height:64px;resize:vertical}}.experience-grid{{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}}.experience article{{border:1px solid var(--line);padding:12px}}.export button{{border:0;background:var(--accent);color:#fff;padding:11px 15px;font-weight:800;cursor:pointer}}.export button:disabled{{background:#91a29e;cursor:not-allowed}}#validation.error{{color:var(--danger)}}@media(max-width:800px){{.ask-grid,.experience-grid{{grid-template-columns:1fr}}.bar{{align-items:start}}.video-head{{flex-wrap:wrap}}}}
</style></head><body>
<header><div class="bar"><div><h1>V3-5.1 固定候选质量复核</h1><div class="meta">Run <code>v3-5.1-production-candidate-20261010T210000Z</code></div></div><div class="status">等待人类判断</div></div></header>
<main><section class="intro"><h2>复核边界</h2><ul><li>自动化已验证结构、真实播放器跳转、四视口、Axe 与性能；本页只补“含义是否正确、引用是否支持、体验是否可用”。</li><li>不要听写、粘贴 Cookie、读取日志或判断哈希。听不清或无法操作时如实选“有关键含义错误”或 BLOCKED。</li><li>先运行固定候选 Runtime，再在锚点视频完成底部五步体验；问答复核可直接依据本页展示的候选输出与视频。</li></ul></section>
<div id="questions"></div>
<section class="experience"><h2>锚点视频五步体验</h2><p>锚点：<a href="https://www.bilibili.com/video/BV1ZpYd66ELP" target="_blank" rel="noreferrer">BV1ZpYd66ELP</a>。依次完成时间线拖动、截图跳转、章节展开、导图节点跳转、跨章节提问。</p><div class="experience-grid" id="experience"></div></section>
<section class="export"><h2>导出不可代签的提交</h2><label>审查者 ID<input id="reviewer" type="text" maxlength="128" autocomplete="off"></label><p id="validation" class="error" role="status">请完成 36 个问答判断、5 个体验判断并填写审查者 ID。</p><button id="export" type="button" disabled>下载质量复核 JSON</button></section></main>
<script>
const runId="v3-5.1-production-candidate-20261010T210000Z";
const candidateSha256={hashes_json};
const videos={payload};
const esc=value=>String(value).replace(/[&<>"']/g,char=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[char]));
const qroot=document.querySelector("#questions");
for(const video of videos){{const section=document.createElement("section");section.className="video";section.innerHTML=`<div class="video-head"><div><h2>候选 ${{video.candidateIndex}} · ${{esc(video.title)}}</h2><div class="meta">${{esc(video.bvid)}} · ${{esc(video.taskId)}}</div></div><a href="https://www.bilibili.com/video/${{encodeURIComponent(video.bvid)}}" target="_blank" rel="noreferrer">打开视频</a></div>`;for(const item of video.questions){{const article=document.createElement("article");article.className="ask";const answers=item.answerBlocks.length?item.answerBlocks.map(block=>`<div class="answer">${{esc(block.text)}}<small>${{Math.round(block.timestampMs/1000)}} 秒 · ${{esc(block.evidenceIds.join(", "))}}</small></div>`).join(""):"<div class='answer'>证据不足，系统拒绝回答。</div>";const key=`${{video.candidateIndex}}-${{item.questionId}}`;article.innerHTML=`<div class="ask-grid"><div><div class="meta">${{esc(item.category)}} · ${{esc(item.questionId)}}</div><p class="question">${{esc(item.question)}}</p></div><div>${{answers}}</div></div><fieldset><legend>含义是否存在关键错误？</legend><div class="choices"><label><input type="radio" name="meaning-${{key}}" value="good"><span>无关键错误</span></label><label><input type="radio" name="meaning-${{key}}" value="bad"><span>有关键错误</span></label></div></fieldset><fieldset><legend>引用是否支持回答？</legend><div class="choices"><label><input type="radio" name="citation-${{key}}" value="good"><span>支持</span></label><label><input type="radio" name="citation-${{key}}" value="bad"><span>不支持</span></label></div></fieldset><textarea data-note="${{key}}" maxlength="2000" aria-label="${{key}} 备注" placeholder="有问题时记录具体位置"></textarea>`;section.append(article)}}qroot.append(section)}}
const ux=[['UX01','拖动时间线','滚轮横移和鼠标拖动都顺畅，刻度与章节仍可读。'],['UX02','点击截图跳转','点击真实截图后，B站播放器跳到对应画面附近。'],['UX03','展开章节','章节层级、关键点和证据关系清楚。'],['UX04','导图节点跳转','导图可缩放/折叠，节点能跳回同一视频。'],['UX05','跨章节提问','回答有用，且引用确实支持跨章节结论。']];const uxroot=document.querySelector('#experience');for(const [id,title,expected] of ux){{const node=document.createElement('article');node.innerHTML=`<h3>${{id}} ${{title}}</h3><p>${{expected}}</p><div class="choices">${{['PASS','FAIL','BLOCKED'].map(value=>`<label><input type="radio" name="${{id}}" value="${{value}}"><span>${{value}}</span></label>`).join('')}}</div><textarea data-ux-note="${{id}}" maxlength="2000" aria-label="${{id}} 备注"></textarea>`;uxroot.append(node)}}
const reviewer=document.querySelector('#reviewer'),button=document.querySelector('#export'),validation=document.querySelector('#validation');
function state(){{const askJudgments=[];for(const video of videos)for(const item of video.questions){{const key=`${{video.candidateIndex}}-${{item.questionId}}`,meaning=document.querySelector(`input[name="meaning-${{key}}"]:checked`)?.value,citation=document.querySelector(`input[name="citation-${{key}}"]:checked`)?.value;askJudgments.push({{candidateIndex:video.candidateIndex,questionId:item.questionId,criticalMeaningError:meaning==='bad',citationSupported:citation==='good',note:document.querySelector(`[data-note="${{key}}"]`).value.trim(),complete:Boolean(meaning&&citation)}})}}const experienceJudgments=ux.map(([id])=>({{requirementId:id,decision:document.querySelector(`input[name="${{id}}"]:checked`)?.value??null,note:document.querySelector(`[data-ux-note="${{id}}"]`).value.trim()}}));const complete=askJudgments.every(item=>item.complete)&&experienceJudgments.every(item=>item.decision)&&reviewer.value.trim();button.disabled=!complete;validation.className=complete?'':'error';validation.textContent=complete?'输入完整，可以导出。':'请完成 36 个问答判断、5 个体验判断并填写审查者 ID。';return{{askJudgments:askJudgments.map(({{complete,...item}})=>item),experienceJudgments}}}}
document.addEventListener('input',state);document.addEventListener('change',state);button.addEventListener('click',()=>{{const data=state();if(button.disabled)return;const questionFailed=data.askJudgments.some(item=>item.criticalMeaningError||!item.citationSupported);const experienceFailed=data.experienceJudgments.some(item=>item.decision==='FAIL');const experienceBlocked=data.experienceJudgments.some(item=>item.decision==='BLOCKED');const overallDecision=questionFailed||experienceFailed?'FAIL':experienceBlocked?'BLOCKED':'PASS';const submission={{schemaVersion:'v3-5.1-human-quality-review/v1',runId,candidateSha256,reviewerId:reviewer.value.trim(),reviewerRole:'independent_human_reviewer',submittedAt:new Date().toISOString(),...data,overallDecision}};const blob=new Blob([JSON.stringify(submission,null,2)+'\\n'],{{type:'application/json'}}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`v3-5.1-human-quality-review-${{overallDecision.toLowerCase()}}.json`;a.click();URL.revokeObjectURL(url);validation.textContent=`已导出 ${{overallDecision}}，请将 JSON 交回项目审计。`}});state();
</script></body></html>''', encoding="utf-8")


if __name__ == "__main__":
    main()
