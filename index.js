
const axios = require("axios");
const bitcore = require("bitcore-lib");
const express = require('express');
const cors = require("cors")
const { subsequentTs } = require('./subsequent');

const app = express();
const port = 4000;


app.use(express.json());
app.use(cors())

app.get('/generate', async (request, response) => {

  try {


    const unconfirmedResponse = await axios.get(
      `https://rest.cryptoapis.io/blockchain-data/bitcoin/testnet/address-transactions-unconfirmed/n3Hhyfpu4nrfEYLBtLVb7fruK8DrAgaKvL?`,
      {
        method: 'GET',
        headers: {
          "Content-Type": "application/json",
          'x-api-key': 'a869f21056f3330f5ae1faf63ab67d57fe0fbee7'
        }
      }
    );

    if (unconfirmedResponse.data.data.items.length === 0) {

      const POLL_INTERVAL = 180000;

      let tsId;

      const fruit_type = request.query.fruit_type
      const quantity = request.query.quantity

      // Fruits available in the shop
      const fruits = {
        "apples": {
          "address": "tb1qsyvek8a3lhzy8j3c3mp84xy9cdy627q2f2pxef",
          "price": 0.0002
        },
        "bananas": {
          "address": "tb1q0f8t6cf8hha6tt43arv6nrpln4p3u8ql96g6em",
          "price": 0.0003
        },
        "oranges": {
          "address": "tb1qsyvek8a3lhzy8j3c3mp84xy9cdy627q2f2pxe",
          "price": 0.0004
        },
        "strawberries": {
          "address": "tb1q3ctrpkl58shfy5hpapgc9km8wx69y5m68350ft",
          "price": 0.0005
        }
      };
      // Retrieve the wallet address and price for the specified fruit
      var recieverAddress = fruits[fruit_type].address;
      //console.log(recipient_address)
      var fruit_price = fruits[fruit_type].price;


      // Calculate the total cost of the fruit purchase
      const total_cost = fruit_price * quantity;
      //console.log(total_cost)
      // Send the payment to the recipient address
      //sendPayment(recipient_address, total_cost);




      const privateKey = "d5ca593be0d480a455747c343e597b8e7e95b8dac1bfa58fbc13a4b795fc0ce4";
      const sourceAddress = "n3Hhyfpu4nrfEYLBtLVb7fruK8DrAgaKvL";
      const satoshiToSend = total_cost * 100000000;





      // Get the latest Unspent Transaction Outputs for sourceAddress using cryptoapis
      // Cryptoapis provides all unspent outputs except the script. 
      // We therefore get the index and transaction ID from the api use that below to get the full unpent outputs.
      const txResponse = await axios.get(
        `https://rest.cryptoapis.io/blockchain-data/bitcoin/testnet/addresses/${sourceAddress}/unspent-outputs?`,
        {
          method: 'GET',
          headers: {
            "Content-Type": "application/json",
            'x-api-key': 'a869f21056f3330f5ae1faf63ab67d57fe0fbee7'
          }
        }
      );

      const txHash = await txResponse.data.data.items[3].transactionId;
      const Txindex = await txResponse.data.data.items[3].index;
      //console.log(txHash)
      //console.log(Txindex)

      // Get the full unspent outputs(UTXO) from tatum api after receiving the hash and index

      const utxresponse = await axios.get(
        `https://api.tatum.io/v3/bitcoin/utxo/${txHash}/${Txindex}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': 'cb661431-9d1f-47c4-9063-70fb4e5fdcb5'
          }
        }
      );

      const transaction = new bitcore.Transaction();
      let totalAmountAvailable = 0;

      let inputs = [];
      let utxos = utxresponse.data;
      //console.log(utxos)

      // Build and arrange the utxo from the unspent outputs received above from Tatum api.
      let utxo = {};
      utxo.address = utxos.address;
      utxo.txId = utxos.hash;
      utxo.outputIndex = utxos.index;
      utxo.satoshis = utxos.value;
      utxo.script = utxos.script;
      totalAmountAvailable += utxo.satoshis;

      // Push the arranged utxo to the utxo array
      inputs.push(utxo);
      console.log(utxo)

      //Set transaction input
      transaction.from(inputs);

      // set the recieving address and the amount to send
      transaction.to(recieverAddress, satoshiToSend);

      // Set change address - Address to receive the left over funds after transfer
      transaction.change(sourceAddress);

      //manually set transaction fees
      transaction.fee(20000);

      // Sign transaction with your private key
      transaction.sign(privateKey);

      // serialize Transactions
      const serializedTransaction = transaction.serialize();
      //console.log(serializedTransaction)

      //broadcast the transaction to be included into a block in the Bitcoin testnet
      // we use cryptoapis to do this
      var https = require("https");

      var options = {
        "method": "POST",
        "hostname": "rest.cryptoapis.io",
        "path": "/v2/blockchain-tools/bitcoin/testnet/transactions/broadcast",
        "qs": { "context": "yourExampleString" },
        "headers": {
          "Content-Type": "application/json",
          "X-API-Key": "a869f21056f3330f5ae1faf63ab67d57fe0fbee7"
        }
      };

      var req = https.request(options, function (res) {
        var chunks = [];

        res.on("data", function (chunk) {
          chunks.push(chunk);
        });

        res.on("end", function () {
          var body = Buffer.concat(chunks);
          var transactionId = JSON.parse(body.toString()).data.item.transactionId;
          response.send(`${transactionId}`);

          setTimeout(() => {
            const checkTransactionStatus = async (txid) => {
              const waitConfirmedResponse = await axios.get(
                `https://rest.cryptoapis.io/blockchain-data/bitcoin/testnet/transactions/${txid}?`,
                {
                  method: 'GET',
                  headers: {
                    "Content-Type": "application/json",
                    'x-api-key': 'a869f21056f3330f5ae1faf63ab67d57fe0fbee7'
                  }
                }
              );
      
              if (waitConfirmedResponse.data.data.item.isConfirmed) {
                const subsequentId = await subsequentTs(fruit_type, quantity);
                console.log("EncodingId:", subsequentId)
              } else {
                // Transaction is unconfirmed, schedule another check
                console.log('Transaction unconfirmed.');
                setTimeout(() => {
                  checkTransactionStatus(txid);
                }, POLL_INTERVAL);
              }
            }
          }, 10000)
      
            checkTransactionStatus(transactionId)
        });
      });

      req.write(JSON.stringify({
        "context": "yourExampleString",
        "data": {
          "item": {
            "signedTransactionHex": serializedTransaction
          }
        }
      }));

      req.end();




      // Output a message with the payment details
      console.log(`Payment of ${total_cost} BTC for ${quantity} ${fruit_type} sent to ${recieverAddress}.`);


    } else {

      response.send("Another transaction is still in progress.")


    }




  } catch (error) {
    return error;
  }

});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

