type CnnStage = {
  title: string;
  detail: string;
  shape: string;
};

const cnnStages: CnnStage[] = [
  {
    title: '输入层',
    detail: '输入水果图像数据，作为卷积神经网络的初始特征表示。',
    shape: '224 x 224 x 3',
  },
  {
    title: '卷积层',
    detail: '利用多个卷积核提取边缘、纹理和局部区域等低层特征。',
    shape: '112 x 112 x 32',
  },
  {
    title: '激活函数',
    detail: '通过 ReLU 等非线性映射增强网络的特征表达能力。',
    shape: '112 x 112 x 32',
  },
  {
    title: '池化层',
    detail: '降低特征图尺寸，保留关键信息并减少计算量。',
    shape: '56 x 56 x 32',
  },
  {
    title: '深层卷积堆叠',
    detail: '继续提取更高层次语义特征，用于区分不同目标类别。',
    shape: '28 x 28 x 64',
  },
  {
    title: '全连接层',
    detail: '对提取到的高维特征进行综合映射和判别。',
    shape: '1 x 1 x 256',
  },
  {
    title: '输出层',
    detail: '输出最终分类或检测结果，例如成熟度或缺陷类别。',
    shape: 'N Classes',
  },
];

export function CnnStructureDiagram() {
  return (
    <div className="diagram-shell">
      <div className="diagram-stage">
        <header className="diagram-title-block">
          <p className="diagram-eyebrow">卷积神经网络结构图</p>
          <h1>卷积神经网络基本结构</h1>
          <p className="diagram-subtitle">
            采用黑白简约学术风展示卷积神经网络从输入层到输出层的基本处理流程。
          </p>
        </header>

        <section className="cnn-diagram">
          <div className="cnn-flow">
            {cnnStages.map((stage, index) => (
              <div key={stage.title} className="cnn-stage">
                <div className="cnn-block">
                  <div className="cnn-block-top">
                    <span className="cnn-block-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="cnn-block-shape">{stage.shape}</span>
                  </div>
                  <h2>{stage.title}</h2>
                  <p>{stage.detail}</p>
                </div>

                {index < cnnStages.length - 1 ? (
                  <div className="cnn-connector" aria-hidden="true">
                    <span className="cnn-connector-line" />
                    <span className="cnn-connector-arrow" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="cnn-legend">
            <div className="cnn-legend-card">
              <strong>结构说明</strong>
              <p>卷积层与池化层负责特征提取，全连接层负责综合判别，输出层给出最终结果。</p>
            </div>
            <div className="cnn-legend-card">
              <strong>适用场景</strong>
              <p>该结构图可用于论文中介绍 CNN 原理，也可作为水果缺陷与成熟度检测模型的理论基础图。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
