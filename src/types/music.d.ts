export interface ScaleSuggestion {
  name: string;
  quality: 'perfect' | 'good' | 'possible';
  notes: string[];
  intervals: string[];
}
