This is a temporary hack until [node-github](https://github.com/mikedeboer/node-github) is [patched](https://github.com/mikedeboer/node-github/pull/537). 

The current version in NPM doesn't support the `enforce_admins` [parameter](https://developer.github.com/v3/repos/branches/#update-branch-protection), which is now required.  Until the Pull Request referenced above is merged, we'll have to manually update the files and then patch the API ourselves.

To patch the API, execute [`./scripts/patch-node-github.sh`](https://octodemo.com/rebelware/repo-template/blob/master/script/patch-node-github.sh`)

This script is called by [`./scripts/bootstrap.sh`](https://octodemo.com/rebelware/repo-template/blob/master/script/bootstrap.sh)`
