import React from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { AnalysisResult, SankeyData } from '../types';

interface SankeyChartProps {
  data: AnalysisResult | null;
}

const SankeyChart: React.FC<SankeyChartProps> = ({ data }) => {
  if (!data || data.diagnoses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        <p>开始对话以生成症状图谱...</p>
      </div>
    );
  }

  // Transform AnalysisResult into SankeyData format for Recharts
  // Recharts Sankey requires strict indices for source/target
  const transformData = (): SankeyData => {
    const nodes: { name: string }[] = [];
    const nodeIndexMap = new Map<string, number>();

    const getOrAddNode = (name: string) => {
      if (!nodeIndexMap.has(name)) {
        nodes.push({ name });
        nodeIndexMap.set(name, nodes.length - 1);
      }
      return nodeIndexMap.get(name)!;
    };

    const links = data.symptomConnections.map(conn => ({
      source: getOrAddNode(conn.symptom),
      target: getOrAddNode(conn.condition),
      value: conn.strength
    }));

    return { nodes, links };
  };

  const chartData = transformData();

  // Custom Node Content
  const renderNode = (props: any) => {
    const { x, y, width, height, index, payload, containerWidth } = props;
    const isOut = x + width + 6 > containerWidth / 2;
    
    // Distinct colors for Symptoms (Left) vs Conditions (Right)
    const isSymptom = !data.diagnoses.some(d => d.name === payload.name);
    const fill = isSymptom ? '#60a5fa' : '#f87171'; // Blue for symptoms, Red for diseases

    return (
      <Layer key={`CustomNode${index}`}>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          fillOpacity="0.9"
        />
        <text
          textAnchor={isOut ? 'end' : 'start'}
          x={isOut ? x - 6 : x + width + 6}
          y={y + height / 2}
          fontSize="12"
          fontWeight="500"
          fill="#334155"
          dy="0.35em"
        >
          {payload.name}
        </text>
      </Layer>
    );
  };

  return (
    <div className="w-full h-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
            <Sankey
            data={chartData}
            node={renderNode}
            nodePadding={50}
            link={{ stroke: '#cbd5e1', fill: 'none' }}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
            <Tooltip content={({ payload }) => {
                if (payload && payload.length > 0) {
                    const data = payload[0];
                    return (
                        <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-xs">
                            <p className="font-semibold">{data.name}</p>
                            <p>关联强度: {data.value}</p>
                        </div>
                    )
                }
                return null;
            }} />
            </Sankey>
        </ResponsiveContainer>
    </div>
  );
};

export default SankeyChart;