import { Request, Response, NextFunction } from 'express';
import * as HttpStatus from 'http-status-codes';
import l from '../common/logger';
import * as shell from 'async-shelljs';
import { SimpleGit, StatusResult } from 'simple-git/promise';
import gitP = require("simple-git/promise");

const GIT:SimpleGit = gitP(process.env.SOURCE_REPO);

const LANGS:string[] = ["java", "python"];

const PROBLEMSET_REMOTE = process.env.PROBLEMSET_REMOTE;

export class GitLabController {
  async gitLabHook(req: Request, res: Response, next: NextFunction) {
    
    //Verify secret token
    let secretToken:string = req.header("X-Gitlab-Token");
    if(secretToken !== process.env.SECRET_TOKEN) {
      l.error("GitLabController: Incorrect secret token provided");
      res.status(HttpStatus.OK).json({ "err": "Wrong secret token"});
      return next();
    }
    
    //Verify the event
    let event:string = req.header("X-Gitlab-Event");
    if(event !== "Merge Request Hook") {
      l.error("GitLabController: GitLab event was not a merge");
      res.status(HttpStatus.OK).json({ "err": "Not a merge"});
      return next();
    }

    //Verify that the merge was accepted and is on the master branch
    let mergeStatus:string = req.body.object_attributes.state;
    let targetBranch:string = req.body.object_attributes.target_branch;

    if(!(mergeStatus == "merged" && targetBranch == "master")) {
      l.error("GitLabController: Merge was not accepted yet/target branch is "
            + "not master");
      res.status(HttpStatus.OK).json({ "err": "Non-applicable merge"});
      return next();
    }

    //Send a response ASAP so GitLab doesn't resend the webhook (GitLab will
    //send another request to this webhook if we don't respond quickly)
    res.status(HttpStatus.OK).json({ "success": "Going to try to copy files"});

    
    let destRootRepo:string = process.env.DEST_REPO_ROOT;

    //Step 1: Pull new problemset repo changes from this push/merge request
    let topicProblemSet:Set<string> = new Set<string>();

    await GIT.pull(PROBLEMSET_REMOTE, "master").then((result:gitP.PullResult) => {

      result.files.forEach((file:string) => {
        //For all the file changes, match the format "*/*/" to detect
        //the Topic/Problem format (e.g. LinkedList/ReverseLinkedList)
        let topicProblemMatch:RegExpMatchArray = file.match(/[\w]+[/][\w]+[/]/g);
        
        if(topicProblemMatch != null) {

          //Use a set to remove duplicates
          //and remove the ending / from each Topic/Problem string
          topicProblemSet.add(topicProblemMatch[0].slice(0, -1));
        }

      });

    }).catch((err:any) => {
      l.error(err);
    });

    //Step 2: Copy any new or changed files for the problem that was just
    //added/updated to the correct executor folders
    /*
      Given a $Problem folder in $Topic:
      -Copy SOURCE_REPO/$Topic/$Problem/java/ to DEST_REPO_ROOT/java/problemset/
                                                          $Topic/$Problem/java/
      -Copy SOURCE_REPO/$Topic/$Problem/python/ to DEST_REPO_ROOT/python/
                                              problemset/$Topic/$Problem/python/

      -Copy SOURCE_REPO/$Topic/$Problem/data.txt to DEST_REPO_ROOT/java/
                                                    problemset/$Topic/$Problem/
      -Copy SOURCE_REPO/$Topic/$Problem/input.in to DEST_REPO_ROOT/java/
                                                    problemset/$Topic/$Problem/

      -Copy SOURCE_REPO/$Topic/$Problem/data.txt to DEST_REPO_ROOT/python/
                                                    problemset/$Topic/$Problem/
      -Copy SOURCE_REPO/$Topic/$Problem/input.in to DEST_REPO_ROOT/python/
                                                    problemset/$Topic/$Problem/
    */
    let promises:Promise<string | void>[] = [];

    topicProblemSet.forEach((topicProblem:string) => {

      LANGS.forEach((lang:string) => {

        l.info("(GitLabController) Processing problem [" + topicProblem 
             + "] on language: " + lang);

        let sourcePath:string = process.env.SOURCE_REPO + topicProblem;
        let destPath:string = destRootRepo + lang + "/problemset/" + topicProblem;

        //Create directories for the problem files recursively
        shell.exec("mkdir -p " + (destPath + "/" + lang + "/"));

        //Copy test code
        promises.push(shell.asyncExec("rsync -rt "
                                    + (sourcePath + "/" + lang + "/") + " "
                                    + (destPath + "/" + lang + "/"))
                      .catch(err => { l.error(err); }));

        //Copy data file (if needed)
        promises.push(shell.asyncExec("rsync -rt "
                                    + (sourcePath + "/data*.txt") + " "
                                    + (destPath + "/"))
                      .catch(err => { l.error(err); }));
        promises.push(shell.asyncExec("rsync -rt "
                                    + (sourcePath + "/input*.in") + " "
                                    + (destPath + "/"))
                      .catch(err => { l.error(err); }));
      });
    });

    await Promise.all(promises).catch(err => { 
      l.error(err);
      return next();
    });

    //Step 3: Commit and push the changes
    LANGS.forEach((lang:string) => {

      shell.exec("bash ./scripts/3-commitpush.sh " + (destRootRepo + lang + "/") 
        + " " + ("\"" + req.body.object_attributes.source_branch + "\"") + " "
        + process.env.GITHUB_USER + " "
        + process.env.GITHUB_PASS + " "
        + lang);
    });

  }
}

export default new GitLabController();