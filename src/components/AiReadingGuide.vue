<template>
  <details class="reading-guide">
    <summary>怎么看这份解读</summary>
    <ul>
      <li><strong>日主</strong>把它当成“你本人最自然的做事方式”，不是命运标签。比如日主是癸水，通常更习惯先观察再行动。</li>
      <li><strong>五行</strong>像五种性格和精力的配比，不是缺什么就一定要补什么；看的是整体平不平衡。</li>
      <li><strong>大运 / 流年</strong>大运像人生阶段的路况，流年像今年的天气；会影响顺逆，但走哪条路仍由你决定。</li>
      <li><strong>卦象 / 动爻</strong>卦象像给当下处境拍一张照片，动爻是照片里正在变化的地方；它提醒哪里容易卡住，不是判决书。</li>
      <li><strong>宜忌</strong>像出门前看一眼天气，穿衣和带伞的选择仍在你自己。</li>
    </ul>
    <p class="reading-guide-example">例如报告里说“先缓一缓”，不是让你什么都不做，而是把“马上争辩”换成“先把要点写下来，半小时后再回复”。</p>
  </details>
</template>

<style scoped>
.reading-guide { margin-top: 22px; border-top: 1px solid var(--line); }
.reading-guide summary { display: flex; min-height: 44px; align-items: center; color: var(--silver); cursor: pointer; font-size: 12px; letter-spacing: 0.1em; }
.reading-guide summary::before { margin-right: 8px; color: var(--muted); content: '+'; }
.reading-guide[open] summary::before { content: '−'; }
.reading-guide ul { display: grid; gap: 10px; padding: 0 0 8px; list-style: none; }
.reading-guide li { padding: 10px 12px; border: 1px solid var(--line); color: var(--silver); font-size: 12px; line-height: 1.8; }
.reading-guide li strong { display: inline-block; margin-right: 7px; color: var(--glow); font-weight: 400; letter-spacing: 0.08em; }
.reading-guide-example { padding: 12px 14px; border: 1px solid var(--line-strong); color: var(--ink-soft); font-size: 12px; line-height: 1.85; }
</style>
