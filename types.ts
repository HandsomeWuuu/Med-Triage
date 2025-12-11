export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  options?: string[];
  allowMultiple?: boolean;
}

export enum UrgencyLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export interface Diagnosis {
  name: string;
  probability: number; // 0-100
  description: string;
  urgency: UrgencyLevel;
  recommendedAction: string;
}

export interface SymptomConnection {
  symptom: string;
  condition: string;
  strength: number; // weight of the link
}

export interface AnalysisResult {
  diagnoses: Diagnosis[];
  symptomConnections: SymptomConnection[];
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}