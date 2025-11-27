export interface DipMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  animation_url?: string;
  
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: 'string' | 'number' | 'date';
    max_value?: number;
  }>;
  
  properties: {
    level_thresholds: {
      [key: string]: number;
    };
    created_at: string;
    last_updated: string;
  };
}

export const CONSTANT_TRAITS = {
  TYPE: 'DeCleanup Impact Product (dIP)',
  IMPACT: 'Environmental',
  CATEGORY: 'Tokenized Cleanups'
} as const;

export const LEVEL_THRESHOLDS = {
  NEWBIE: 1,
  PRO: 10,
  HERO: 50,
  GUARDIAN: 100
} as const;

export type LevelName = keyof typeof LEVEL_THRESHOLDS; 