import * as express from 'express';

import GitLabController from './routing/GitLabController';

const router = express.Router();

/* General auth endpoints */
router.post('/api/gitLabHook', GitLabController.gitLabHook);

export default router;
