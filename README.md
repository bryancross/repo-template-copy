# repo-template

Utility server which accepts requests to create new repositories based on 
configuration files.  The server implements a standard GitHub workflow by creating
a Pull Request in a configured repository with the parameters of the request.  
When that Pull Request is merged, the server traps the event via a webhook and 
automatically creates the new repository according to the configuration.

Repo-template is designed work as part of a specially designated and configured repository which serves
to accept and store repository requests.  Learn more about how to configure this repository [below](https://octodemo.com/rebelware/repo-template/blob/update-readme/README.md#request-repository)

### Getting Started

1. Setup a repository to store your repository configuration pull requests (see  #request-repository below).
1. Clone the `repo-template` repository.
1. Run `./script/bootstrap.sh`
1. Run `./script/tunnel.sh` to create an `ngrok` proxy for your webhooks to call.  Ensure your webhooks call this URL when you setup your Request Repository.
1. Update the `callbackURL` attribute in `/config/config.json` with the URL created by ngrok. 
1. Run ./script/repo_template.sh to start the server
    `./script/repo_template.sh start`
1. Make a REST call to the GET `/init` endpoint.  Include a properly scoped PAT in the Authentication header.
  - You can use the `Server Init` request in the Postman collection (in `/tests/repo-template.postman_collection.json`)
  - cURL: 

```shell
curl --location --request GET 'http://localhost:3000/init' \  # Default ngrok local URL
--header 'Content-Type: application/json' \
--header 'Auth: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'     # GitHub PAT, properly scoped
```


1. make a REST call to the POST `/createRepo` endpoint with the appropriate payload. 
```javascript
{"newRepoOwner":"OrgOrUser"
,"newRepoName":"aRepoName"
,"newRepoTemplate":"default"     
,"newRepoRequester":"someguy"}
```
  - You can use the `CreateRequestPR` request in the Postman collection (in `/tests/repo-template.postman_collection.json`)
  - cURL: 

```shell
curl --location --request POST 'http://localhost:3000/createRepo' \
--header 'Content-Type: application/json' \
--header 'Authorization: token XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' \
--data-raw '{"newRepoOwner":"<GitHub-UserID-or-OrgName>",
"newRepoName":"aName999",
"newRepoTemplate":"default",
"newRepoRequester":"<requestor-GitHub-UserID"}'
```

### Modes of operation
    
Repo-template performs 2 functions:
    
1. Create Pull Requests requesting new repositories.
2. Responding to repo request Pull Requests, creating new repositories when they are merged.
    
In all cases, you can configure repo-template to:
    
 - Create a repository
 - Add teams and individuals as collaborators
 - Create branches
 - Configure branch protection
 - Configure webhooks
    
#### Postman REST API call configurations

If you use [postman](https://www.getpostman.com/docs/), you can import and use
the postman collection stored in `./tests/repo-template-postman_collection.json`.  Just be sure to
replace the place-holders with a properly scoped GitHub PAT.
    
#### Future work

  Some ideas which seem useful include:
  - [ ] Specify an existing repository as a template
  - [ ] Specify a repository and create a configuration file describing it for future use
  - [X] Parse Pull Requests on merge for specific text which would trigger a new repository build.  Parameters to be included in the body of the PR
  - [ ] Include webhooks in configuration of new repositories
  - [X] Manage configuration data in a repository rather than the filesystem.
  
#### TODO

  - [ ] Add tests
  - [X] Add provision for passing username and PAT as part of the request to the server
  - [X] Add provision to flush job log to file.
    
### Command line Usage
Usage:  `repo-template.sh cmd <options>`

  Create a copy of a repository from a configuration file.  
  
  - Create a repository
  - Add teams and individuals as collaborators
  - Create branches
  - Configure branch protection
  
 #### COMMANDS

| Command | Description |
| -------- | ---------- |
| `start` | Start the repo-template server.  Returns JSON with the jobID |
| `stop` | Stop the repo-template server |
| `tunnel` | Start an nginix proxy.  Useful for testing webhooks |
| `suspend` | Stop the repo-template server from resopnding to requests |
| `resume` | Unsuspend the repo-template server so that it resopnds to requests |
| `status` | Return whether the server is suspended or responding to commands |
| `reloadRepoConfigs` | Reload repository configurations |
| `reloadConfig` | Reload the server configuration |
| `create-repo targetHost newRepoOwner newRepoName newRepoTemplate newRepoRequester` | Create a new repository on 'github.foo.com' named 'NewRepo', using the parameters defined in ./config/repo_templates/default.json and owned by the octocat org. |


 OPTIONS:

| Option | Description |
| ------ | ----------- |
| `targetHost` | GitHub.com or a GHE server |
| `newRepoName` | Name for the new repository |
| `newRepoTemplate` | Configuration file stored in ./config/repo_templates to use in creating the new repository |
| `newRepoOwner` | Name of a GitHub org to own the new repo |
| `newRepoRequester` | Name of a GitHub user requesting the repository.|

 EXAMPLES:

  Start the repo-template server.  

    repo-template start
     
  Stop the repo-template server:

      repo-template stop

  Suspend the repo-template server so that it won't respond to requests

      repo-template suspend

  Resume the repo-template server responding to requests

      repo-template resume

  Get the status of the repo-template server, whether it is responding to
  events or suspended

      repo-template status
      
  Reload repository configurations
        
      repo-template reloadRepoConfigs

  Reload server configuration
        
      repo-template reloadServerConfig

  Create a new repository on 'github.foo.com' named 'NewRepo', using the
  parameters defined in ./config/repo_templates/default.json and owned by the
  octocat org.

      repo-template create-repo octodemo.com rebelware NewRepo admackbar

## Calling the Server using REST

All repo template functionality is available through the REST API.

| Endpoint | Parameters | Description |
| -------- | ----------- | ---------- |
| /suspend | - | Suspend the server |
| /resume| - | Resume the server |
| /pullrequest | - | Endpoint to trap Pull Request merge events.  Configure as a repository webhook |
| /stop | - | Shutdown the server |
| /reloadConfig | - | Reload server configuration files |
| /reloadRepoConfigs | - | Reload repository configuration files |
| /status | `jobID` (optional) - ID of the job for which to report status<br/>`format` - If `"html"` return HTML, otherwise return JSON | Call with no arguments to return whether the server is suspended or not.  Call with jobID parameters to get the log for that job.  Optionally return results as JSON or HTML |
| /createRepo | `targetHost` - Host to create the repository on<br/>`newRepoName` - Name of the new repository<br/>`configName` - Repository configuration to use<br/>`orgName` - Organization owning the new Repo<br/>`userPAT` - PAT of an org or site admin<br/>`username` - Username corresponding to the userPAT| Create a repository with the specified configuration|

              
## Responding to Pull Requests
              
If you want repo-template to automatically create new repositories when request Pull Requests are merged,
you'll need to create a webhook.  

1. Create a webhook in a repository pointing to https://<your_server>:<your_port>/pullrequest endpoint
2. Configure the webhook to respond to Pull Request events and push events.

To create a repository request:

Create a file in the repository configured to serve such requests and include the following JSON:

1. Include configuration parameters as well as the REPOSITORY_REQUEST token in the body of the PR.  Be sure to replace the values with those meaningful in your environment:

```JSON
{
 "newRepoOwner":"someid"
,"newRepoName":"aName"
,"newRepoTemplate":"aTemplate"
,"newRepoRequester":"someguy"
}
```
 
2. Commit the file to a new branch
3. Create a Pull Request against the branch configured for this purpose by the `repoRequestBranch` parameter in 
 `./config/config.json`
4. When the PR is merged, the webhook will send the configuration parameters to the /pullrequest endpoint.

Once the repository is created, repo-template will create an issue with a link to the log file for the 
creation process

##  Configuration

#### Request Repository 
 
 Repo-template is intended work as a webhook service against a specially designated and configured _request repository_.  
 Users will commit configuration files referencing pre-defined templates, and then create Pull Requests in this repository with 
 those commits.  Administrators can then review the Pull Requests, make changes to the configuration files, and then merge or 
 deny the Pull Request.  Repo-Template will automatically create repositories according to the configuration files when the 
 pull request is merged.
 
#### Request Repository configuration

1. Create a repository, e.g., repoRequests
2. Protect the master branch, limiting those who can push to the branch to a team tasked with reviewing and approving 
repository creation requests.  
3. Create a webhook pointing to the `pullrequest` endpoint on your instance of the repo-template server.
5. Grant access to whomever in your organization you'd like to be able to make requests for new repositories.

#### Application configuration

There are two application level configurations:
 - Server configuration: Default parameters for the repo-template server

### Server Configuration

Server configuration is stored in `./config/config.json`.  This file also serves
as the template for the job logging mechanism.    

NOTE: The user specified must currently be a site admin

```json
  "adminUserName": "",  // Username corresponding to the adminGitHubPAT
  "authType": "oauth",  // auth type.  Currently only oauth is supported
  "TemplateSourceHost": "octodemo.com",  // Host for repository where repository configurations are stored
  "TemplateSourceRepo": "bryancross/repo-template",  // Repository where repository configurations are stored
  "TemplateSourcePath": "config/repo_templates",  // Path in repository where repository configurations are stored
  "TemplateSourceBranch": "master" //Branch where the production versions of templates are stored
  "repoDescriptionSuffix": "--Created by repo-template",  // Suffix appended to repository descriptions
  "commitMsg": "Committed by repo-template" //Commit message for configuration files committed by repo-template
  "callbackURL": "https://somewhere" //Public URL for the server, used in creating links to log files, etc.
  "userAgent": "repo-template",  // User agent to use in GitHubAPI REST calls
  "callback": "",  // Not implemented
  "jobsLimit": 1000,  // Maximum number of jobs to retain in memory
  "gitAPIDebug": false,  // Set debug flag for GitHubAPI
  "hubotRoomID": "something",//something to do with Hubot
  "repoRequestHost": "octodemo.com" //Host for the repo request repo.
  "repoRequestRepo": "rebelware/repoRequests" //The repository where repo-template will create Pull Requests
  "repoRequestBranch": "master" //Branch repo-template will watch for PR merges containing repository requests
  "repoRequestPath":"" //Not implemented
  "repoRequestPRLabels": [  //Not implemented
  "Repo Request"
  ]
```

### Command line configuration

The command line scripts require a `.env` file in the `./scripts` directory.  Required parameters include:

`REPO_TEMPLATE_URL=http://localhost:3000`

## Repository Configuration
    
Configuration data for new repositories are stored in JSON files in the `./config/repo_templates` directory.
    
There are 6 sections in the file:

 - Header: Info about the configuration, including it's name
 - Repository Attributes: Configuration information about the repository
 - Teams: Teams to be added as collaborators.
 - Branches: Branches to be created
 - Directories: Directories to be created in the new repository (not implemented)
 - Files: Files to be copied into the new repository (not implemented)
    
### Repository Configuration: Header
The header section identifies the configuration:
    
```json
  "configName":"default" // The name of the configuration to be specified when calling the server
  ,"configType":"repository" //The configuration type, currently only 'repository'
  ,"owningOrganization":"bryancross" //Owning organization
```    

### Repository Configuration: Repository Attributes

This section conforms to the GitHub API options specified in the Repository Create
API call.

For more information, see the [API Docs](https://developer.github.com/v3/repos/#create)
For more information on the Preview API options for merging pull requests, see the 
relevant [blog post](https://developer.github.com/changes/2016-09-26-pull-request-merge-api-update/)

```json
 "name": "Default",  // Repository name.  Replaced by newRepoName
  "description": "Default description",  //A short description of the repository
  "homepage": "https://github.com",  //A URL with more information about the repository
  "private": false,  // true to create a private repository, or false to create a public one
  "has_issues": true,  // true to enable issues for the repository, false to disable them
  "has_projects": true,  // true to enable projects for the repository, false to disable them
  "has_wiki": true,  // true to enable the wiki for this repository, false to disable it
  "auto_init": true,  //true to create an initial commit with an empty README.md
  "gitignore_template": "",  // Desired language or platform .gitignore template to apply
  "license_template": "mit",  // Desired LICENSE template to apply
  "allow_rebase_merge": true,  // true to allow rebase-merging pull-requests.
  "has_downloads": true,  // true to enable downloads
  "allow_squash_merge": true,  // true to allow squash-merging pull requests
  "allow_merge_commit": true,  // true to allow merging pull requests with a merge commit
  "team_id": -1  // ID of the team that will be granted access to this repository.  Currently not used.
```

### Repository Configuration: Teams

This section identifies teams to be added as collaborators to the new repository.

This section generally conforms to the GitHub API options specified in the Teams section
of the GitHub API.  The exception is that you can specify a team by name.

For more information, see the [API Docs](https://developer.github.com/v3/orgs/teams/#add-or-update-team-repository)

```json
"teams":
    [
      {
         "team":"Developers",  // Team name
        "permission":"push" // Permissions
      }
      ,...
```

### Repository Configuration: Branches

This section identifies branches to be created in the new repository, as well as 
protections to be applied to those branches.  These conform to the Update branch
protection call in the GitHub API.

For more information, see the [API Docs](https://developer.github.com/v3/repos/branches/#update-branch-protection)

```json
"branches":
  [
    {
      "name":"master", //branch name
      "protection": {
        "required_status_checks": { //enable required status checks 
          "include_admins": true, //Include admins
          "strict": true, //Require branches to be up to date before merging
          "contexts": [
            "continuous-integration/travis-ci" //Reqired status contexts
          ]
        },
        "required_pull_request_reviews": { //Require PR reviews
          "include_admins": false //Include admins in PR reviews
        },
        "enforce_admins": true, 
        "restrictions": { //Users and teams who can push to the branch
          "users": [
            "Mario"
          ],
          "teams": [
            "DevLeads"
          ]
        }
      }
    }
    ,...

```
## Logging
 - The server system log is written to `./log/repo-template.log`
 - Log info for each repository creation job is written to the `./log` directory
 with the jobID as the filename.
