// Copyright 2014 Joyent, Inc.  All rights reserved.
//
// These tests ensure that docker flag works as expected when setting/unsetting
//

var async = require('/usr/node/node_modules/async');
var execFile = require('child_process').execFile;
var fs = require('fs');
var libuuid = require('/usr/node/node_modules/uuid');
var VM = require('/usr/vm/node_modules/VM');
var vmtest = require('../common/vmtest.js');

// this puts test stuff in global, so we need to tell jsl about that:
/* jsl:import ../node_modules/nodeunit-plus/index.js */
require('nodeunit-plus');

VM.loglevel = 'DEBUG';

var common_payload = {
    alias: 'test-create-filesystems',
    autoboot: true,
    brand: 'joyent-minimal',
    do_not_inventory: true,
    max_locked_memory: 512,
    max_physical_memory: 512,
    max_swap: 1024
};
var image_uuid = vmtest.CURRENT_SMARTOS_UUID;


function haveMount(uuid, source, target, callback) {
    var args = [uuid, '/usr/sbin/mount'];
    var cmd = '/usr/sbin/zlogin';

    execFile(cmd, args, function (error, stdout, stderr) {
        var found = false;

        if (error) {
            callback(error, {'stdout': stdout, 'stderr': stderr});
        } else {
            stdout.split('\n').forEach(function (line) {
                if (line.indexOf('/hello on ' + source) === 0) {
                    found = true;
                }
            });
            if (found) {
                callback(null, {'stdout': stdout, 'stderr': stderr});
            } else {
                callback(new Error('mount not found'),
                    {'stdout': stdout, 'stderr': stderr});
            }
        }
    });
}

test('test creating new VM with created filesystem', function (t) {
    var new_uuid = libuuid.create();
    var payload = JSON.parse(JSON.stringify(common_payload));
    var state = {brand: payload.brand};
    var vmobj;

    payload.filesystems = [
        {
            source: new_uuid,
            target: '/hello',
            type: 'zfs',
            options: []
        }
    ];

    vmtest.on_new_vm(t, image_uuid, payload, state, [
        function (cb) {
            VM.load(state.uuid, function (err, obj) {
                t.ok(!err, 'loading obj for new VM');
                if (err) {
                    cb(err);
                    return;
                }

                vmobj = obj;

                t.equal(obj.state, 'running', 'VM is running');
                t.ok(obj.filesystems.length === 1, 'num filesystems (expect 1):'
                    + ' ' + obj.filesystems.length);
                t.ok(obj.filesystems[0].source === obj.zfs_filesystem
                    + '/volumes/' + new_uuid, 'source has transformed: '
                    + obj.filesystems[0].source);
                t.ok(obj.filesystems[0].target === '/hello', 'target is '
                    + obj.filesystems[0].target);
                cb();
            });
        }, function (cb) {
            if (vmobj.filesystems && vmobj.filesystems.length > 0) {
                haveMount(vmobj.uuid, vmobj.filesystems[0].source, '/hello',
                    function (err, fds) {
                        if (err) {
                            t.ok(false, 'missing mount for /hello');
                            cb(err);
                            return;
                        }
                        t.ok(true, 'have mount for /hello');
                        cb();
                    }
                );
            } else {
                cb();
            }
        }
    ]);
});
