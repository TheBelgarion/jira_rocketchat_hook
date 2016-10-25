# jira_rocketchat_hook

incoming webhook for jira integarion

some actions depend on your installation and might not work for you, mostly 'custom:*'

look at https://rocket.chat/docs/administrator-guides/integrations/jira on how to setup an incmoing webhook in your rocketchat
and https://developer.atlassian.com/jiradev/jira-apis/webhooks#Webhooks-Registeringawebhook on how to set up your Jira part.

for production usage you should set DEBUG to false, or the script will spam your logfile a lot.
