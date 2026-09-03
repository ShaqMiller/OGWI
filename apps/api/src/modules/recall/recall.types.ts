export interface TopicKeyPointRecord {
  id: string;
  plainName: string;
  cueQuestion: string;
  tier: 'CRITICAL' | 'SUPPORTING';
}

export interface TopicKeyPoints {
  topicName: string | null;
  keyPoints: TopicKeyPointRecord[];
}
