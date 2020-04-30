# GitLab --> GitHub Copier Webhook
A small Express.js server I made for use as a GitLab webhook on one of my team projects.

It detects when branches are merged into the master branch of a GitLab repository, and copies the changed files to a separate GitHub repository.

This is used in our Google Cloud Build pipeline. Our GitHub repository
is automatically built as a Docker image via Cloud Build, but we need
to selectively copy files into that GitHub repository from our working repository on GitLab.