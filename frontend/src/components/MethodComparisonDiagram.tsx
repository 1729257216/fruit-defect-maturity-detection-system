type FlowStep = {
  title: string;
  detail: string;
};

const traditionalFlow: FlowStep[] = [
  {
    title: '水果图像输入',
    detail: '采集待检测水果图像，作为传统方法的处理起点。',
  },
  {
    title: '人工特征设计',
    detail: '人工选择颜色、纹理、形状等表征特征。',
  },
  {
    title: '特征提取与编码',
    detail: '将人工定义特征转换为可供模型处理的向量。',
  },
  {
    title: '传统分类器判别',
    detail: '使用 SVM、KNN 或决策树等模型完成识别。',
  },
  {
    title: '简单场景输出结果',
    detail: '更适用于背景简单、目标单一的检测环境。',
  },
];

const deepLearningFlow: FlowStep[] = [
  {
    title: '水果图像输入',
    detail: '采集待检测水果图像，送入深度学习检测网络。',
  },
  {
    title: '自动特征学习',
    detail: '模型从样本中自动学习判别性视觉特征。',
  },
  {
    title: '卷积神经网络提取',
    detail: '通过多层卷积结构提取深层语义信息。',
  },
  {
    title: '目标检测模型推理',
    detail: '利用 YOLO 等检测模型同时完成定位与分类。',
  },
  {
    title: '复杂场景输出结果',
    detail: '更适用于遮挡、光照变化和多目标场景。',
  },
];

function FlowDiagram({
  title,
  subtitle,
  tag,
  steps,
  tone,
}: {
  title: string;
  subtitle: string;
  tag: string;
  steps: FlowStep[];
  tone: 'traditional' | 'deep';
}) {
  return (
    <section className={`flow-diagram flow-diagram-${tone}`}>
      <header className="flow-diagram-header">
        <span className="flow-diagram-tag">{tag}</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      <div className="flow-track" aria-hidden="true" />

      <div className="flow-step-list">
        {steps.map((step, index) => (
          <div key={step.title} className="flow-step-card">
            <div className="flow-step-connector" aria-hidden="true">
              <span className="flow-step-rail" />
              {index < steps.length - 1 ? <span className="flow-step-corner" /> : null}
            </div>

            <div className="flow-step-content">
              <span className="flow-step-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="flow-step-text">
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MethodComparisonDiagram() {
  return (
    <div className="diagram-shell">
      <div className="diagram-stage">
        <header className="diagram-title-block">
          <p className="diagram-eyebrow">水果检测流程图</p>
          <h1>两种检测方法的独立流程展示</h1>
          <p className="diagram-subtitle">
            将传统水果检测方法和基于深度学习的水果检测方法分别绘制为单独流程图，连线采用直角样式。
          </p>
        </header>

        <div className="flow-diagram-stack">
          <FlowDiagram
            title="传统水果检测方法流程图"
            subtitle="强调人工特征设计、特征提取与传统分类器识别过程。"
            tag="Traditional Flow"
            steps={traditionalFlow}
            tone="traditional"
          />

          <FlowDiagram
            title="基于深度学习的水果检测方法流程图"
            subtitle="强调自动特征学习、卷积神经网络与目标检测模型推理过程。"
            tag="Deep Learning Flow"
            steps={deepLearningFlow}
            tone="deep"
          />
        </div>
      </div>
    </div>
  );
}
