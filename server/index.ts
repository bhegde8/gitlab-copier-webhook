import './common/env';
import router from './router'
import Server from './common/server';

const port = parseInt(process.env.PORT);

export default new Server()
  .router(router)
  .listen(port);
