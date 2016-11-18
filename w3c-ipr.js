var async = require("async")
;

var fromUrlToId = function(url) { return url.replace(/.*\//, "");};

module.exports = function iprcheck(w3c, w3cprofileid, name, w3cgroupids, store, cb) {
    async.map(
        w3cgroupids
        , function(g, groupcb) {
            store.getGroup(g, function(err, group) {
                if (err) return groupcb(err);
                w3c.user(w3cprofileid)
                    .participations()
                    .fetch({embed: true},
                           function(err, participations) {
                               if (err) return groupcb(err);
                               for (var i = 0 ; i < participations.length; i++) {
                                   var p = participations[i];
                                   var org = p._links.organization;
                                   var affiliation = p.individual ? {id: w3cprofileid, name: name} : {id: fromUrlToId(org.href), name: org.title};
                                   if (p._links.group.href === "https://api.w3.org/groups/" + g) {
                                       return groupcb(null, {ok: true, affiliation: affiliation});
                                   }
                               }
                               // If we reach here,
                               // the user is not participating directly in the group
                               // For non WGs, game over
                               if (group.groupType != "WG") {
                                   return groupcb(null, {ok: false});
                               }
                               // For WGs, we check if the user is affiliated
                               // with an organization that is participating
                               w3c.group(g)
                                   .participations()
                                   .fetch(function(err, participations) {
                                       if (err) return groupcb(err);
                                       var orgids = participations.map(function(p) { return fromUrlToId(p.href);});
                                       w3c.user(w3cprofileid)
                                           .affiliations()
                                           .fetch(function(err, affiliations) {
                                               if (err) return groupcb(err);
                                               var affids = affiliations.map(function(a) { return fromUrlToId(a.href);});
                                               var intersection = orgids.filter(function(id) {
                                                   return affids.indexOf(id) !== -1;
                                               });
                                               if (intersection.length) {
                                                   var affiliationId = intersection[0];
                                                   var affiliationName = affiliations.filter(function(a) { return a.href == "https://api.w3.org/affiliations/" + affiliationId;})[0].title;
                                                   return groupcb(null, {ok: true, affiliation: {id: affiliationId, name: affiliationName}});
                                               }
                                               return groupcb(null, {ok: false});
                                           });
                                   });
                           });
            });
        }, function(err, results) {
            if (err) return cb(err);
            for(var i = 0 ; i < results.length; i ++) {
                var res = results[i];
                if (res.ok) {
                    return cb(null, {affiliation: res.affiliation, ok: true});
                }
            }
            return cb(null, {affiliation: null, ok: false});
        });
};
