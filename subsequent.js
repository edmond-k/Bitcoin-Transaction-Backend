const axios = require("axios");
const bitcore = require("bitcore-lib");


const subsequentTs = async(fruit_type, number) => {
    try {
        const privateKey = "d5ca593be0d480a455747c343e597b8e7e95b8dac1bfa58fbc13a4b795fc0ce4";
        const sourceAddress = "n3Hhyfpu4nrfEYLBtLVb7fruK8DrAgaKvL";
        //const satoshiToSend = total_cost * 100000000;

        const quantity = number.toString();
        const purchaseDetails = fruit_type.concat(" ", quantity)
        // Get the latest Unspent Transaction Outputs for sourceAddress using cryptoapis
        // Cryptoapis provides all unspent outputs except the script. 
        // We therefore get the index and transaction ID from the api use that below to get the full unpent outputs.
        const substxResponse = await axios.get(
          `https://rest.cryptoapis.io/blockchain-data/bitcoin/testnet/addresses/${sourceAddress}/unspent-outputs?`,
          {
            method: 'GET',
            headers: {
              "Content-Type": "application/json",
              'x-api-key': 'api-key-here'
            }
          }
        );
    
        const txHash = await substxResponse.data.data.items[3].transactionId;
        const Txindex = await substxResponse.data.data.items[3].index;
        //console.log(txHash)
        //console.log(Txindex)
    
        // Get the full unspent outputs(UTXO) from tatum api after receiving the hash and index
    
        const subsutxresponse = await axios.get(
          `https://api.tatum.io/v3/bitcoin/utxo/${txHash}/${Txindex}`,
          {
            method: 'GET',
            headers: {
              'x-api-key': 'api-key-here'
            }
          }
        );
    
        const transaction = new bitcore.Transaction();
        let totalAmountAvailable = 0;
    
        let inputs = [];
        let utxos = subsutxresponse.data;
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
        //transaction.to(recieverAddress, satoshiToSend);
    
        transaction.addData(purchaseDetails)
    
        // Set change address - Address to receive the left over funds after transfer
        transaction.change(sourceAddress);
    
        //manually set transaction fees
        transaction.fee(20000);
    
        // Sign transaction with your private key
        transaction.sign(privateKey);
    
        // serialize Transactions
        const subsserializedTransaction = transaction.serialize();
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
            "X-API-Key": "api-key-here"
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
            console.log("encodedId:", transactionId)
            return transactionId
          });
        });

       
        req.write(JSON.stringify({
          "context": "yourExampleString",
          "data": {
            "item": {
              "signedTransactionHex": subsserializedTransaction
            }
          }
        }));
    
        req.end();
    
    
    
        // Output a message with the payment details
        console.log(`Payment Details encoded on the blockchain with TransactionIdof ${transactionId}`);
      } catch (error) {
    
      }
}

module.exports = {
    subsequentTs
};