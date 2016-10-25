/**
 * @author TheBelgarion@github
 *
 * @version: 1.01
 * @summary: script to setup an incoming webhook in rocket.chat for jira export webhook
 *
 * * jshint  esnext:true
 *
 */
class Script {
    process_incoming_request({request}) {
        if (!(request.content && request.content.webhookEvent)) {
            return {
                error: {
                    success: false,
                    message: 'no webhook event found in content'
                }
            };
        }

        const DEBUG = true;
        const MAXLENGTH = 500;

        let channel = false;

        if (request.url.query.channel != '') {
            channel = '#' + request.url.query.channel;
        }
        try {
            let issue = request.content.issue;
            let comment = request.content.comment;
            let ref_url = issue.self;
            let url_parts = /^(\w+\:\/\/)?([^\/]+)(.*)$/.exec(ref_url);
            let url_origin = url_parts[1] + url_parts[2];
            let user_login = request.content.user.name;
            let user_name = request.content.user.displayName;
            let avatar_url = request.content.user.avatarUrls["16x16"];
            let issue_type = issue.fields.issuetype.name;
            let issue_icon = issue.fields.issuetype.iconUrl;
            let issue_number = issue.key;
            let issue_title = issue.fields.summary;
            let issue_url = url_origin + '/browse/' + issue_number;
            let issue_link = '[' + issue_number + '](' + issue_url + ')';

            var attachments = [];
            var attachment = {
                author_icon: issue_icon,
                author_name: issue_title,
                author_link: issue_url,
                fields: []
            };
            attachments.push(attachment);

            var text = '![' + issue_type + '](' + issue_icon + ')' + ' *' + issue_link + '*';

            switch (request.content.webhookEvent) {
                case 'jira:issue_created':
                    text = 'issue created ' + text;
                    if (issue.fields.creator) {
                        attachment.fields.push({
                            title: 'creator',
                            value: issue.fields.creator.displayName,
                            short: true
                        });
                    }
                    break;
                case 'jira:issue_updated':
                    text = 'issue updated ' + text;
                    let items = this.get_action_items(request);
                    let item = null;
                    for (let i = 0; i < items.length; ++i) {
                        item = items[i];
                        switch (item.value) {

                            case 'jira:assignee':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: issue.fields.assignee.displayName,
                                    short: true
                                });
                                break;

                            case 'jira:status':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: issue.fields.status.name,
                                    short: true
                                });
                                break;

                            case 'jira:labels':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: item.item.toString,
                                    short: true
                                });
                                break;

                            case 'jira:description':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: issue.fields.description,
                                    short: true
                                });
                                break;

                            case 'jira:resolution':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: issue.fields.resolution.name,
                                    short: true
                                });
                                break;

                            case 'custom:sprint':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: 'changed' + item.item.fromString + ' to ' + item.item.toString,
                                    short: true
                                });
                                break;

                            case 'jira:fix version':
                                if (item.item.toString != '') {
                                    attachment.fields.push({
                                        title: item.item.field,
                                        value: item.item.toString,
                                        short: true
                                    });
                                }
                                break;

                            case 'jira:priority':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: 'changed' + item.item.fromString + ' to ' + item.item.toString,
                                    short: true
                                });

                                break;

                            case 'jira:attachment':
                                let att = this.get_attachment(issue, item.item.to);
                                if (att) {
                                    attachment.text = 'attachment';
                                    if (/^image/i.test(att.mimeType)) {
                                        attachment.image_url = url_origin + att.image;
                                    }
                                }
                                break;

                            case 'custom:acceptance criteria':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: item.item.toString,
                                    short: true
                                });
                                break;

                            case 'jira:summary':
                                // summary already shown
                                break;
                            // ignored actions
                            case 'jira:timeestimate':
                            case 'jira:timespent':
                            case 'jira:worklogid':
                            case 'custom:lest link':
                            case 'custom:epic status':
                            case 'custom:rank':
                                if (DEBUG) {
                                    attachment.fields.push({
                                        title: 'ignored action',
                                        value: item.value,
                                        short: true
                                    });
                                } else {
                                    return false;
                                }
                                break;
                            default:
                                if (DEBUG) {
                                    item.title = 'unknown action';
                                    attachment.fields.push(item);
                                } else {
                                    return false;
                                }
                        }
                    }
                    break;

                // ignored web events
                case 'jira:worklog_updated':
                    if (DEBUG) {
                        attachment.fields.push({
                            title: 'ignored event',
                            value: request.content.webhookEvent,
                            short: true
                        });
                    } else {
                        return false;
                    }
                    break;
                default:
                    if (DEBUG) {
                        attachment.fields.push({
                            title: 'unknown web hook event',
                            value: request.content.webhookEvent,
                            short: true
                        });
                        attachment.fields.push({
                            title: 'issue',
                            value: issue.fields.summary,
                            short: true
                        })
                        ;
                    } else {
                        return false;
                    }
            }
            if (comment) {
                attachment = {
                    author_icon: comment.author.avatarUrls['48x48'],
                    author_name: comment.author.displayName + ' added a comment',
                    text: this.comment(comment.body, MAXLENGTH)
                };
                attachments.push(attachment);

            }
        } catch (e) {
            console.log('webhook event error', e);
            return {
                error: {
                    success: false,
                    message: `${e.message || e} ${JSON.stringify(request.content)}`
                }
            };
        }

        if (DEBUG) {
            console.log(JSON.stringify(request.content));
        }
        var result = {
            content: {
                alias: 'JIRA',
                text: text,
                attachments: attachments,
                link_names: true
            }
        };
        // send to other channel than predefined on script
        if (channel) {
            result.content.channel = channel;
        }
        return result;
    }

    get_action_items(request) {
        var items = [];
        if (!request.content.changelog) {
            return items;
        }
        let item = null;
        let action = '';
        let jira_items = request.content.changelog.items;
        for (let i = 0; i < jira_items.length; ++i) {
            item = jira_items[i];
            if (item.fromString != item.toString) {
                action = item.fieldtype + ':' + item.field;

                items.push({
                    title: 'action',
                    value: action.toLowerCase(),
                    item: item,
                    short: true
                });
            }
        }
        return items;
    }

    get_attachment(issue, id) {
        let url = false;
        if (issue.fields.attachment) {
            for (let i = 0; i < issue.fields.attachment.length; ++i) {
                if (issue.fields.attachment[i].id == id) {
                    url = {
                        image: '/secure/attachment/' + id + '/' + issue.fields.attachment[i].filename,
                        thumb: '/secure/thumbnail/' + id + '/_thumb_' + issue.fields.attachment[i].filename,
                        mimeType: issue.fields.attachment[i].mimeType
                    };
                }
            }
        }
        return url;
    }

    //currently unused
    collect_users(request) {
        let users = [];
        if (request.user) users[request.user.key] = request.user;
        if (request.issue.fields.assignee) users[request.issue.fields.assignee.key] = request.issue.fields.assignee;
        if (request.issue.fields.creator) users[request.issue.fields.creator.key] = request.issue.fields.creator;
        if (request.issue.fields.reporter) users[request.issue.fields.reporter.key] = request.issue.fields.reporter;
        // comments, attachments[author, update_author]
        return users;
    }

    comment(text, length) {
        if (text.length > length) {
            let s = text.substr(0, length - 1);
            text = text.substr(0, s.lastIndexOf(' ')) + '\n...';
        }
        // link users only works correct with you use same user e.g. LDAP on JIRA and Rocketchat
        text = text.replace(/(\[\~)(\w\.\w*)(\])/g, "@$2");
        return text;
    }
}
