#!/usr/bin/env bash

#/Usage:  repo-template.sh cmd <options>
#/
#/  Create a Pull Request requesting the creation of a new repository.  If the
#/  Pull Request is merged, the repository will be created automatically.
#/
#/        - Create a repository, and optionally, depending on the configuration
#/          - Add teams and individuals as collaborators
#/          - Create branches
#/          - Configure branch protection
#/
#/ COMMANDS:
#/
#/  start	Start the repo-template server
#/
#/  stop	Stop the repo-template server
#/
#/  tunnel  Start an Nginx proxy.
#/
#/  suspend	Stop the repo-template server from resopnding to requests
#/
#/  resume	Unsuspend the repo-template server so that it resopnds to requests
#/
#/  status  Return whether the server is suspended or responding to commands
#/
#/  reloadRepoConfigs Reload repository configurations
#/
#/  create-repo newRepoOwner newRepoName newRepoTemlate newRepoRequester
#/
#/
#/ OPTIONS:
#/
#/  targetHost              GitHub.com or a GHE server
#/
#/  newRepoName             Name for the new repository
#/
#/  newRepoTemplate         Configuration file stored in ./config/repo_templates
#/                          to use in creating the new repository
#/
#/  newRepoOwner            Name of a GitHub org to own the new repo
#/
#/  newRepoRequest          Username of a GitHub user requesting the new
#/                          repository
#/
#/ EXAMPLES:
#/
#/  Start the repo-template server.  Do not respond to webhook events.  Useful for
#/  testing.
#/
#/     repo-template start
#/
#/  Stop the repo-template server:
#/
#/      repo-template stop
#/
#/  Suspend the repo-template server so that it won't respond to requests
#/
#/      repo-template suspend
#/
#/  Resume the repo-template server responding to requests
#/
#/      repo-template resume
#/
#/  Get the status of the repo-template server, whether it is responding to
#/  events or suspended
#/
#/      repo-template status
#/  Pass at PAT for use in authenticating GitHub API requests
#/
#/      repo-template authenticate PAT
#/
#/  Reload repository configurations
#/
#/      repo-template reloadRepoConfigs
#/
#/  Reload server configuration
#/
#/      repo-template reloadConfig
#/
#/
#/  Create a Pull Request requesting a new repository on 'octodemo.com' named
#/  'NewRepo', using the parameters defined in
#/  ./config/repo_templates/default.json and owned by the rebelware org.
#/
#/      repo-template create-repo octodemo.com rebelware NewRepoRequester admackbar
#/
#/
source_dir=$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
source "$source_dir/.env"
echo $USER_1_AUTH_TOKEN

CMD_JSON=""
FLAG_JSON=""
CMD_OPTION=0
clear
for word in $@
do
     case "$word" in
        create-repo)
            TARGET_HOST = "${1}"
            shift
            CMD_JSON="{\"newRepoOwner\":\"${1}\","
            shift
            CMD_JSON=$CMD_JSON"\"newRepoName\":\"${1}\","
            shift
            CMD_JSON=$CMD_JSON"\"newRepoTemplate\":\"${1}\","
            shift
            CMD_JSON=$CMD_JSON"\"newRepoRequester\":\"${1}\""
            CMD_OPTION=1
            break
            ;;
        tunnel)
            ./tunnel.sh
            exit 0
            ;;
        start)
            echo "Starting repo-template server"
            clear
            node rt.js
            exit 0
            ;;
        stop|suspend|resume|status|reloadRepoConfigs|reloadConfig)
            echo "----------------------------" 
	        echo "Attempting to ${1} repo-template server"
            # we need to change how this is called as
            # these should not be exposed outside the appliance
            # curl -X GET ${REPO_TEMPLATE_URL}/${1}
	    echo
	    echo "----------------------------"
            exit 0
            ;;
        *)
            #echo "CMD_OPTION: "$CMD_OPTION
            if [ $CMD_OPTION -eq 0 ]; then
                grep '^#/' <"$0" | cut -c 4-
                echo
                echo "Invalid argument: "$word
                exit 1
            else
                CMD_OPTION=0
            fi
      esac
done
echo "CMD_OPTION: "$CMD_OPTION
            if [ $CMD_OPTION -eq 0 ]; then
                grep '^#/' <"$0" | cut -c 4-
                echo
                echo "Invalid argument: "$word
                exit 1
            else
                CMD_OPTION=0
            fi


CMD_JSON=$CMD_JSON"}"
echo "----------------------------"
curl -X POST -d ${CMD_JSON} -H "Authorization: token ${USER_1_AUTH_TOKEN}" -H "User-Agent: repo-template" -H 'Accept: application/vnd.github.v3.raw' ${REPO_TEMPLATE_URL}"/createRepo"
echo
echo "----------------------------"
exit 0

