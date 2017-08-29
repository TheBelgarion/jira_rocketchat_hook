/**
 * @author TheBelgarion@github
 *
 * @version: 1.05
 * @summary: script to setup an incoming webhook in rocket.chat for jira export webhook
 *
 * * jshint  esnext:true
 *
 */
class Script {

    process_incoming_request({request}) {
        const DEBUG = false;
        if (!(request.content && request.content.webhookEvent)) {
            if (DEBUG) {
                return { content: { text : 'No WebHook Event found ' + JSON.stringify(request.content)}};
            }
            return {
                error: {
                    success: false,
                    message: 'no webhook event found in content'
                }
            };
        }

        const MAXLENGTH = 1500;

        let channel = false;

        if (request.url.query.channel != '') {
            channel = '#' + request.url.query.channel;
        }
        try {

            let comment = false;
            let ref_url = '';
            let issue = '';
            ref_url = '';
            let user_login = '';
            let user_name = '';
            let avatar_url = '';
            let issue_type = '';
            let issue_icon = '';
            let issue_number = '';
            let issue_title = '';
            let issue_url = '';
            let name = '';
            switch (request.content.webhookEvent) {
                case 'jira:issue_created':
                case 'jira:issue_deleted':
                case 'jira:issue_updated':
                    issue = request.content.issue;
                    ref_url = issue.self;
                    user_login = request.content.user.name;
                    user_name = request.content.user.displayName;
                    avatar_url = request.content.user.avatarUrls["16x16"];
                    issue_type = issue.fields.issuetype.name;
                    issue_icon = issue.fields.issuetype.iconUrl;
                    issue_number = issue.key;
                    issue_title = issue.fields.summary;
                    issue_url = url_origin + '/browse/' + issue_number;
                    comment = request.content.comment;
                    break;
                case 'comment_created':
                case 'comment_updated':
                    comment = request.content.comment;
                    ref_url = comment.self;
                    // ignore event for now, because there is no direct link to an issue
                    return true;
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
            let url_parts = /^(\w+\:\/\/)?([^\/]+)(.*)$/.exec(ref_url);
            let url_origin = url_parts[1] + url_parts[2];

            var attachments = [];
            var attachment = {
                author_icon: issue_icon,
                author_name: issue_title,
                author_link: issue_url,
                fields: []
            };
            attachments.push(attachment);

            var text = '';
            var issue_link  = this.get_issue_link( url_origin, issue_number, issue_type, issue_icon);

            switch (request.content.webhookEvent) {
                case 'jira:issue_created':
                    text = 'issue created ' + issue_link;
                    if (issue.fields.creator) {
                        attachment.fields.push({
                            title: 'created by',
                            value: this.get(issue,'fields.creator.displayName'),
                            short: true
                        });
                    }
                    break;
                case 'jira:issue_deleted':
                    text = 'issue deleted ' + issue_link;
                    /** @todo: check which field is set for the deletor **/
                    if (issue.fields.creator) {
                        attachment.fields.push({
                            title: 'deleted by',
                            value: this.get(issue,'fields.creator.displayName'),
                            short: true
                        });
                    }
                    break;
                case 'jira:issue_updated':
                    text = 'issue updated ' + issue_link;
                    let items = this.get_action_items(request);
                    let item = null;
                    for (let i = 0; i < items.length; ++i) {
                        item = items[i];
                        switch (item.value) {

                            case 'jira:assignee':
                                if(issue.fields.assignee == null) {
                                    name = 'Unassigned';
                                } else name = this.get(issue, 'fields.assignee.displayName');
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: name,
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

                            case 'jira:issuetype':
                            case 'jira:fix version':
                            case 'jira:labels':
                            case 'custom:acceptance criteria':
                            case 'custom:story points':
                            case 'custom:environment':
                                if (item.item.toString != '') {
                                    attachment.fields.push({
                                        title: item.item.field,
                                        value: item.item.toString,
                                        short: true
                                    });
                                }
                                break;

                            case 'jira:project':
                                text = 'issue moved to ' + item.item.toString + ' ' + issue_link;
                                break;

                            case 'jira:key':
                                attachment.fields.push({
                                    title: 'old key',
                                    value: item.item.fromString,
                                    short: true
                                });
                                break;

                            case 'jira:priority':
                            case 'custom:sprint':
                                attachment.fields.push({
                                    title: item.item.field,
                                    value: item.item.fromString + ' => ' + item.item.toString,
                                    short: true
                                });
                                break;

                            case 'jira:attachment':
                                let att = this.get_attachment(issue, item.item.to);
                                if (att) {
                                    attachment.fields.push({
                                        title: 'Attachment',
                                        value: 'added',
                                        short: true
                                    });
                                    if (/^image/i.test(att.mimeType)) {
                                        attachment.image_url = url_origin + att.image;
                                    }
                                } else {
                                    attachment.fields.push({
                                        title: 'Attachment',
                                        value: 'deleted',
                                        short: true
                                    });                                    }
                                break;

                            case 'jira:summary':
                                // summary already shown
                                break;
                            // ignored actions
                            case 'jira:timeestimate':
                            case 'jira:timespent':
                            case 'jira:worklogid':
                            case 'jira:workflow':
                            case 'custom:lest link':
                            case 'custom:epic status':
                            case 'custom:epic name':
                            case 'custom:rank':
                                if (DEBUG) {
                                    attachment.fields.push({
                                        title: 'ignored action',
                                        value: item.value,
                                        short: true
                                    });
                                }
                                break;
                            default:
                                if (DEBUG) {
                                    item.title = 'unknown action';
                                    attachment.fields.push(item);
                                }
                        }
                    }
                    // no known actions found, dont show
                    if (attachment.fields.length == 0 && !comment ) {
                        return true;
                    }
                    break;

                    // ignored web events
                case 'comment_created':
                case 'comment_updated':
                case 'jira:worklog_updated':
                    if (DEBUG) {
                        attachment.fields.push({
                            title: 'ignored event',
                            value: request.content.webhookEvent,
                            short: true
                        });
                    } else {
                        return true;
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
                let comm = this.comment(comment.body, MAXLENGTH);
                if(request.content.issue_event_type_name == 'issue_comment_edited') {
                    attachment = {
                        author_icon: comment.updateAuthor.avatarUrls['48x48'],
                        author_name: this.get(comment, 'updateAuthor.displayName') + ' edited a comment',
                        text: comm.text,
                        link_names: 1
                    };

                } else {
                    attachment = {
                        author_icon: comment.author.avatarUrls['48x48'],
                        author_name: this.get(comment, 'author.displayName') + ' added a comment',
                        text: comm.text,
                        link_names: 1
                    };
                }

                if (comm.mentions.length > 0) {
                    var mem = ' (mentions ';
                        comm.mentions.forEach(
                        function (user) {
                            mem = mem + user  + ', ';
                        }
                    );
                    // disabled because it automatically invites all mentioned to the room
                    // text = text + mem.substr(0,mem.length-2) + ')';
                }
                attachments.push(attachment);

            }
        } catch (e) {
            if (DEBUG) {
                console.log('error ' + JSON.stringify(request.content));
                return { content: { text : 'webhook event error ' + e + ' ' + JSON.stringify(request.content)}};
            } else {
                console.log('webhook event error', e);
            }
            return {
                error: {
                    success: false,
                    message: `${e.message || e} ${JSON.stringify(request.content)}`
                }
            };
        }
        var result = {
            content: {
                alias: 'JIRA',
                text: text,
                attachments: attachments,
                link_names: 1
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
                item.fromString = (null == item.fromString ? '' : item.fromString);
                item.toString =  (null == item.toString ? '' : item.toString);
                item.field = item.field.toLowerCase();
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

    get_issue_link(base_url, issue, type, icon) {
        let link = '[' + issue + '](' + base_url + '/browse/' + issue + ')';
        return ('![' + type + '](' + icon + ')' + ' *' + link + '*');
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

    get(obj, prop) {
        let value = '';
        try {
           value = prop.split('.').reduce(function(p, c) {
           return (p.hasOwnProperty(c) && p[c]) || null;
           }, obj);
       } catch (e) {
            console.log('property ', prop , ' not found.');
            return false;
       }
        return value;
    }

    comment(text, length) {
        // link users only works correct if you use same user e.g. LDAP on JIRA and Rocketchat
        let mention = text.match(/\[~(\w*\.\w*)]/g);
        var mentions = [];
        if (mention != null) {
            mention.forEach(
                function (user) {
                    mentions.push(user.replace(/(\[~)(\w*\.\w*)(])/g, "@$2"));
                }
            );
        }
        // code blocks like php, sql
        text = text.replace(/\{code\[:]*(\w*)}([\.\W\S]*)\{code}/g, "```$1$2```");
        text = text.replace(/(\r)/g, '');
        if (text.length > length) {
            let s = text.substr(0, length - 1);
            text = text.substr(0, s.lastIndexOf(' ')) + '\n...';
        }
        return {'text': text, 'mentions': mentions};
    }
}