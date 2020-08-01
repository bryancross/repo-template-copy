# Description:
#   A hubot script for creating new repositories using repo-template
#
# Commands:
#   hubot repo repo-org repo-name repo-template
#
# Author: @pholleran

module.exports = (robot) ->

  repoTemplateURL = "https://gentle-anchorage-60792.herokuapp.com/createRepo"

  robot.respond /repo (.*)/i, (msg) ->

    params = msg.match[1].split " "

    if robot.adapterName is "slack"
      room = msg.message.user.room
      
      if room?
        unless room is "C5R9AQS3F"
          msg.send "Shhh I can't help you here. Meet me in the alley, or better yet; in #repo-requests"
          return

    repoJSON = JSON.stringify({
      "newRepoOwner": params[0],
      "newRepoName": params[1],
      "newRepoTemplate": if params[2]? then params[2] else "default",
      "newRepoRequester": "hubot"
    })
    
    robot.http(repoTemplateURL)
      .post(repoJSON) (err, resp, bod) ->
        if err
          msg.send err
          return

  robot.router.post "/hubot/createRepo/:room", (req, res) ->
    
    room   = req.params.room
    data   = if req.body.payload? then JSON.parse req.body.payload else req.body

    dataJSON = JSON.stringify(data)
    reply = "Here's the PR to create your new repo: #{data.html_url}"

    if robot.adapterName is "slack"
      robot.messageRoom room, reply
    else
      console.log reply

    res.send 'OK'