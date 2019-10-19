const mariadb = require('mariadb');
var Request = require('request-promise');
var OutShareInstance = require('./out_share_instance');
// const pool = mariadb.createPool({host: '192.168.5.19', user: 'test_usr', password: 'nopass', port: '4008', database: 'test_db', connectionLimit: 5});
const pool = mariadb.createPool(
  {
      host: 'devdbgw.scopehub.org',
      user: 'ScopHApplication',
      password: '@5|AA/Fq~l@P',
      port: '4008',
      database: 'ScopehubAppDB',
      connectionLimit: 10,
      connectTimeout: 5000,
      permitLocalInfile: true

  });
console.log('start active connections', pool.activeConnections());
console.log('start total connections', pool.totalConnections());
console.log('start idle connections', pool.idleConnections());
console.log('start taskQueueSize connections', pool.taskQueueSize());
asyncFunction();

async function asyncFunction() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log('1 before active connections', pool.activeConnections());
        console.log('before total connections', pool.totalConnections());
        console.log('before idle connections', pool.idleConnections());
        console.log('before taskQueueSize connections', pool.taskQueueSize());
        var conn1 = await pool.getConnection();
        console.log('2 before active connections', pool.activeConnections());
        console.log('before total connections', pool.totalConnections());
        console.log('before idle connections', pool.idleConnections());
        console.log('before taskQueueSize connections', pool.taskQueueSize());
        var conn2 = await pool.getConnection();

        console.log('connected ! connection id is ' + JSON.stringify(conn));
        //  console.log(pool);
        //   pool.query('select * from test_tbl', null, { metadata: false } )
        await conn.query('select * from OutShare where accountId=uuid_to_bin("236c9b39-9fd9-4774-8456-64b0bc5d1d32")', [],
          [], {metadata: false})
          .then(Data => {
              const dataLenght = Data.length - 1;
              console.log(Data.length);
          });
        conn.end();
        console.log('before active connections', pool.activeConnections());
        console.log('before total connections', pool.totalConnections());
        console.log('before idle connections', pool.idleConnections());
        console.log('before taskQueueSize connections', pool.taskQueueSize());

        for (var i = 0; i < 5; i++) {
            console.log(' active connections ***********', i, pool.activeConnections());
            console.log(' total connections', pool.totalConnections());
            console.log(' idle connections', pool.idleConnections());
            console.log(' taskQueueSize connections', pool.taskQueueSize());
            var create = await OutShareInstance.createDebugTest(pool);
            var get = await OutShareInstance.getDebugTest(pool);

        }

        // var test = await OutShareInstance.testGet(pool);

        //conn.end(); //release to pool
        console.log('after active connections', pool.activeConnections());
        console.log('after total connections', pool.totalConnections());
        console.log('after idle connections', pool.idleConnections());
        console.log('after taskQueueSize connections', pool.taskQueueSize());


        /*//var conn1 = await pool.getConnection();
        var create = await OutShareInstance.createDebugTest(pool);
        var get = await OutShareInstance.getDebugTest(pool);
        // var test = await OutShareInstance.testGet(pool);

        console.log('before active connections', pool.activeConnections());
        console.log('before total connections', pool.totalConnections());
        console.log('before idle connections', pool.idleConnections());
        console.log('before taskQueueSize connections', pool.taskQueueSize());

        // conn1.end(); //release to pool
        console.log('after active connections', pool.activeConnections());
        console.log('after total connections', pool.totalConnections());
        console.log('after idle connections', pool.idleConnections());
        console.log('after taskQueueSize connections', pool.taskQueueSize());


        // var conn2 = await pool.getConnection();
        var create = await OutShareInstance.createDebugTest(pool);
        var get = await OutShareInstance.getDebugTest(pool);
        //  var test = await OutShareInstance.testGet(pool);

        console.log('after active connections', pool.activeConnections());
        console.log('after total connections', pool.totalConnections());
        console.log('after idle connections', pool.idleConnections());
        console.log('after taskQueueSize connections', pool.taskQueueSize());
        // conn.end();*/
    } catch (err) {
        throw err;
    }
    /*finally {
           if (conn) {
               console.log('Inside connection end');
               return conn.end();
           }
       }*/
}

/*
pool.getConnection()
  .then(async conn => {
      console.log('connected ! connection id is ' + JSON.stringify(conn));
      //  console.log(pool);
      //   pool.query('select * from test_tbl', null, { metadata: false } )
      await conn.query('select * from OutShare where accountId=uuid_to_bin("236c9b39-9fd9-4774-8456-64b0bc5d1d32")', [],
        [], {metadata: false})
        .then(Data => {
            const dataLenght = Data.length - 1;
            console.log(Data.length);
        });

      console.log('before active connections', pool.activeConnections());
      console.log('before total connections', pool.totalConnections());
      console.log('before idle connections', pool.idleConnections());
      console.log('before taskQueueSize connections', pool.taskQueueSize());

      var create = await OutShareInstance.createDebugTest(pool);
      var get = await OutShareInstance.getDebugTest(pool);
      var test = await OutShareInstance.testGet(pool);

      /!* console.log('before active connections', pool.activeConnections());
       console.log('before total connections', pool.totalConnections());
       console.log('before idle connections', pool.idleConnections());
       console.log('before taskQueueSize connections', pool.taskQueueSize());*!/

      //conn.end(); //release to pool
      console.log('after active connections', pool.activeConnections());
      console.log('after total connections', pool.totalConnections());
      console.log('after idle connections', pool.idleConnections());
      console.log('after taskQueueSize connections', pool.taskQueueSize());
  })
  .catch(err => {
      console.log('not connected due to error: ' + err);
  });
*/

