import type { ModuleEntity, Qualification, Topic } from '@ogwi/shared';

export interface QualificationWithModules extends Qualification {
  modules: ModuleEntity[];
}

export type { Qualification, ModuleEntity, Topic };
