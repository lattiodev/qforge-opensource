### 1. Set env 
ip=194.247.186.29
port=31841

### 2. Check tick
```sh
build/qubic-cli -nodeip $ip -nodeport $port -getcurrenttick
```

### 3. Identify test account 
```sh
build/qubic-cli -nodeip $ip -nodeport $port -seed totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu -showkeys  
```
```txt
Seed: totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu
Private key: mhdstzjuhqvqlcekkuiprdkbyxgejpeacamsstyeqffuqyittaeiucaeqzta
Public key: qfwapccduomnycvxngxujqquhpeboutcwxphgcniadqioajayacsyeedlwwa
Identity: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA

```

### Asset api test
### 4.1.1 Issue asset
```sh
assetName=QSWAP0
build/qubic-cli -nodeip $ip -nodeport $port -seed totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu -qswapissueasset $assetName 100000 0000000 0
```

#### 4.1.2 Check asset result
```sh
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
build/qubic-cli -nodeip $ip -nodeport $port -getasset $issuer 
```
```txt
======== OWNERSHIP ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Issuance Index: 12015066
Number Of Shares: 100000
Asset Digest: 70402d50a0186895ded0fd44407807102a857ab4e1a356e86149813463ef52db
Tick: 24133235

======== POSSESSION ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Owner index: 12015067
Owner ID: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Number Of Shares: 100000
Asset Digest: 70402d50a0186895ded0fd44407807102a857ab4e1a356e86149813463ef52db
Tick: 24133235
```

### 4.2.1 Asset transfer test
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
newIdentity=LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
build/qubic-cli -nodeip $ip -nodeport $port -seed totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu -qswaptransferasset $assetName $issuer $newIdentity 100 
```

###
```sh
build/qubic-cli -nodeip $ip -nodeport $port -getasset $newIdentity 
```

### 4.2.2 Check transfer result
```log
======== OWNERSHIP ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Issuance Index: 12015066
Number Of Shares: 100
Asset Digest: 623799c3b22cef51cb4bd96939d3e8d7bb6b0fb8f020c692cde6e45438d9fab4
Tick: 24133425

======== POSSESSION ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Owner index: 14557971
Owner ID: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
Number Of Shares: 100
Asset Digest: 623799c3b22cef51cb4bd96939d3e8d7bb6b0fb8f020c692cde6e45438d9fab4
Tick: 24133425
```

### 5 Pool api test
#### 5.1.1 Create pool
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
build/qubic-cli -nodeip $ip -nodeport $port -seed totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu -qswapcreatepool $assetName $issuer
```

#### 5.1.2 get pool state
* 5.1.2.1 valid pool
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
build/qubic-cli -nodeip $ip -nodeport $port -qswapgetpoolbasic $assetName $issuer
```
```txt
GetPoolBasicState reserveQu: 0, reserveAsset: 0, liqudity: 0
```

* 5.1.2.2 invalid pool
```sh
build/qubic-cli -nodeip $ip -nodeport $port -qswapgetpoolbasic QSWAP1 $issuer
```

```txt
GetPoolBasicState pool not exist
```

### 5.2 Liqudity api test

#### 5.2.1 Add liqudity
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
quAmount=10000
assetAmount=10000
quAmountMin=0
assetAmountMin=0
build/qubic-cli -nodeip $ip -nodeport $port -seed totoxkjotcbtjsezkjntqplunblkfkgxqjquqhscerrvfcfonbpoufu -qswapaddliqudity $assetName $issuer $quAmount $assetAmount $quAmountMin $assetAmountMin
```

#### 5.2.2 Get pool state after add liqudity
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
build/qubic-cli -nodeip $ip -nodeport $port -qswapgetpoolbasic $assetName $issuer
```

```txt
GetPoolBasicState reserveQu: 10000, reserveAsset: 10000, liqudity: 10000
```

#### 5.2.3 Get liqudity of the account
```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
identity=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
build/qubic-cli -nodeip $ip -nodeport $port -qswapgetliqudityof $assetName $issuer $identity
```

> init stake liqudity is 10000, but pool will lock the first 1000, so the result is 9000 <br>
> [permanently lock the first MINIMUM_LIQUIDITY tokens](https://github.com/Uniswap/v2-core/blob/ee547b17853e71ed4e0101ccfd52e70d5acded58/contracts/UniswapV2Pair.sol#L121)

```log
GetLiqudityOf result amount: 9000
```

### 5.3 Quote api test -qswapquote
#### 5.3.1 quote exact qu input

```sh
# assetName=QSWAP0
# issuer=QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
```
```sh
build/qubic-cli -nodeip $ip -nodeport $port -qswapquote exact_qu_input $assetName $issuer 1000
build/qubic-cli -nodeip $ip -nodeport $port -qswapquote exact_qu_output $assetName $issuer 1000
build/qubic-cli -nodeip $ip -nodeport $port -qswapquote exact_asset_input $assetName $issuer 1000
build/qubic-cli -nodeip $ip -nodeport $port -qswapquote exact_asset_output $assetName $issuer 1000
```
```txt
Quote result amount: 906
Quote result amount: 1114
Quote result amount: 906
Quote result amount: 1114
```

### 5.4 Swap api test
#### 5.4.1 -qswapswapexactquforasset, qu -> pool -> asset

#### 5.4.1.1 swap account
```txt
Seed: vpxtniwwnrlsnmompiuzhqroxovvxaljoxvmamkkfgopkukcrwhnrjh
Private key: jldvvwksnsnvhczkcmdzncykjipgktbmwheiirirhgnpdjlajhtxliihacjj
Public key: liwywqkzmrzirgrsfblbwddxegddsezinxsyiclwddkhyoppouutmvjdqpng
Identity: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
```

```sh
identity=LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
build/qubic-cli -nodeip $ip -nodeport $port -getbalance $identity
build/qubic-cli -nodeip $ip -nodeport $port -getasset $identity 
```

```txt
Identity: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
Balance: 15000000000
Incoming Amount: 15000000000
Outgoing Amount: 0
Number Of Incoming Transfers: 1
Number Of Outgoing Transfers: 0
Latest Incoming Transfer Tick: 15500593
Latest Outgoing Transfer Tick: 0
Tick: 24134871
Spectum Digest: ff27a3b424f273541d718c49195c3c81038de7609000ac54e142cb6c9bd6af06

======== OWNERSHIP ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Issuance Index: 12015066
Number Of Shares: 100
Asset Digest: 3eb8afaf3f9af83e74cc77c1ea0d114eb14b68e359029cd553fc9bcf2284475e
Tick: 24134876

======== POSSESSION ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Owner index: 14557971
Owner ID: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
Number Of Shares: 100
Asset Digest: 3eb8afaf3f9af83e74cc77c1ea0d114eb14b68e359029cd553fc9bcf2284475e
Tick: 24134877
```

```sh
seed=vpxtniwwnrlsnmompiuzhqroxovvxaljoxvmamkkfgopkukcrwhnrjh
build/qubic-cli -nodeip $ip -nodeport $port -seed $seed -qswapswapexactquforasset $assetName $issuer 1000 0
```

```output
Sending QSWAP swapExactQuForAsset action - procedureNumber: 6
Issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
assetName: QSWAP0
qu amount in: 1000
asset amount out min: 0
Sending QSWAP swapExactQuForAsset action - procedureNumber: 6

-------------------------------------

Transaction has been sent!
~~~~~RECEIPT~~~~~
TxHash: nsuwcetrrhiydakxoprklwxwbobeocwcayhuefnhhcxlucfpidrrkzqfxtae
From: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
To: NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAML
Input type: 6
Amount: 1000
Tick: 24134942
Extra data size: 48
Extra data: da55b7f99f3b5665df1d92f7f374822892759760995bbb6768f30014fc25d96c51535741503000000000000000000000
MoneyFlew: N/A
~~~~~END-RECEIPT~~~~~
run ./qubic-cli [...] -checktxontick 24134942 nsuwcetrrhiydakxoprklwxwbobeocwcayhuefnhhcxlucfpidrrkzqfxtae
to check your tx confirmation status
```

```sh
# identity=LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
build/qubic-cli -nodeip $ip -nodeport $port -getbalance $identity
build/qubic-cli -nodeip $ip -nodeport $port -getasset $identity 
```

> balance 15000000000 -1000 = 14999999000
> asset 100 + 906 = 1006

```txt
Identity: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
Balance: 14999999000
Incoming Amount: 15000000000
Outgoing Amount: 1000
Number Of Incoming Transfers: 1
Number Of Outgoing Transfers: 1
Latest Incoming Transfer Tick: 15500593
Latest Outgoing Transfer Tick: 24134942
Tick: 24134990
Spectum Digest: 3a2bb39c1d08cf240c823f360631b895367fb4218712243398bfcff5c9078616


======== OWNERSHIP ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Issuance Index: 12015066
Number Of Shares: 1006
Asset Digest: e535ee8058fc19397dcf0a3a2b45914c4966aaf6fbb8b062d1a8c32cd35f6e67
Tick: 24135017

======== POSSESSION ========
Asset issuer: QFWAPCCDUOMNYCVXNGXUJQQUHPEBOUTCWXPHGCNIADQIOAJAYACSYEEDLWWA
Asset name: QSWAP0
Managing contract index: 13
Owner index: 14557971
Owner ID: LIWYWQKZMRZIRGRSFBLBWDDXEGDDSEZINXSYICLWDDKHYOPPOUUTMVJDQPNG
Number Of Shares: 1006
Asset Digest: e535ee8058fc19397dcf0a3a2b45914c4966aaf6fbb8b062d1a8c32cd35f6e67
Tick: 24135018
```