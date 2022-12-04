import React, { useEffect, useState, useCallback } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, SafeEventEmitterProvider } from '@web3auth/base';
import { OpenloginAdapter } from '@web3auth/openlogin-adapter';
import './App.css';
import RPC from './web3RPC'; // for using web3.js
import { Box, Button, Flex, IconButton, Image, Input, Switch, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useClipboard } from '@chakra-ui/react';
import { getBytes32FromIpfsHash, getContent, getIpfsHashFromBytes32, hashBytes, uploadIPFS } from './lib/utils';
import { PasswordManagerABI } from './lib/abi'
import { Contract, providers, } from 'ethers';
import { formatBytes32String } from "ethers/lib/utils";
const clientId =
	'BKiF8dG3ZXkMquPB4iszdYdTQ1UjnKWsrix0mCReDI2w10UMq2VaVMja-KY9_m8NoEBSQ8WX7QzK6N6Zb1-OeEg'; // get from https://dashboard.web3auth.io

function App() {
	const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
	const [provider, setProvider] = useState<SafeEventEmitterProvider | null>(
		null,
	);
	const [passwordManagerContract, setPasswordManagerContract] = useState(null)
	const [usernameOrEmail, setUsernameOrEmail] = useState<string>('');
	const [password, setPassword] = useState<string>('')
	const [currentUrl, setCurrentUrl] = useState<string>('');
	const [isFullPage, setIsFullPage] = useState(false);
	const [userAddress, setUserAddress] = useState();
	const [credentials, setcredentials] = useState({ usernameOrEmail: '', password: '' })
	const [reveal, setReveal] = useState(0);
	const { onCopy, value, setValue, hasCopied } = useClipboard("");

	useEffect(() => {
		const init = async () => {
			try {
				const web3auth = new Web3Auth({
					clientId,
					chainConfig: {
						chainNamespace: CHAIN_NAMESPACES.EIP155,
						chainId: '0x5',
						rpcTarget: process.env.REACT_APP_ETHEREUM_URL ?? 'https://goerli.infura.io/v3/dea0bafefe244d9f9152e260ad5f583d',
					},
					uiConfig: {
						theme: 'light',
						loginMethodsOrder: ['facebook', 'google'],
						defaultLanguage: 'en',
						appLogo: 'https://web3auth.io/images/w3a-L-Favicon-1.svg', // Your App Logo Here
					},
				});

				const openloginAdapter = new OpenloginAdapter({
					loginSettings: {
						mfaLevel: 'optional',
					},
					adapterSettings: {
						clientId,
						network: 'testnet',
						uxMode: 'popup',
						whiteLabel: {
							name: 'De Keeper',
							logoLight: 'https://web3auth.io/images/w3a-L-Favicon-1.svg',
							logoDark: 'https://web3auth.io/images/w3a-D-Favicon-1.svg',
							defaultLanguage: 'en',
							dark: true, // whether to enable dark mode. defaultValue: false
						},
					},
				});
				web3auth.configureAdapter(openloginAdapter);

				setWeb3auth(web3auth);

				await web3auth.initModal();
				if (web3auth.provider) {
					setProvider(web3auth.provider);

					const provider = new providers.Web3Provider(web3auth.provider);
					const signer = provider.getSigner();
					setPasswordManagerContract(new Contract('0xfBB86493C252003E560291Db761e28ad1110Ac1E', PasswordManagerABI.abi, signer))

				}
			} catch (error) {
				console.error(error);
			}
		};

		init();

		if (window.innerWidth > 400) setIsFullPage(true);

		chrome?.tabs?.query({ active: true, lastFocusedWindow: true }, tabs => {
			let url = tabs[0].url as string;
			console.log(tabs);
			setCurrentUrl(url)
			// Do something with url
		});
	}, []);

	useEffect(() => {
		(async () => {
			console.log({currentUrl, passwordManagerContract})
			if (currentUrl && passwordManagerContract) {
				await fetchCredentials();
			}
		})()

	}, [passwordManagerContract, currentUrl])



	const saveCredentails = useCallback(async () => {

		let currentDate = new Date()
		const message = currentDate.getTime().toString() + "#" + JSON.stringify({ usernameOrEmail, password })
		uiConsole(`Saving your credentials...`)

		try {
			// setWaiting(true)
			const cid = await uploadIPFS(message)
			if (!cid) {
				throw "Upload to IPFS failed"
			}
			console.log(`IPFS CID: ${cid}`)

			const u = new URL(currentUrl);

			const acc = await getAccounts();

			const tx = await passwordManagerContract.addDomain((`${acc}__${u.host}`), (cid));

			const receipt = await tx.wait();

			if (receipt) {
				setPassword('');
				setUsernameOrEmail('');
				console.log(`Your credentials are saved 🎉`)
				uiConsole('Your credentials are saved 🎉')
			}
		} catch (error) {
			console.error(error)

			console.log("Some error occurred, please try again!")
		} finally {
			// setLoading.off()
			// setWaiting(false)
		}
	}, [usernameOrEmail, password])

	const fetchCredentials = () => {
		(async () => {
			try {
				const acc = await getAccounts();
				const u = new URL(currentUrl);
				const key = `${acc}__${u.host}`
				console.log(key)

				const message = await passwordManagerContract.connect(acc)['fetchDomainCID(string)'](key);

				console.log(await getContent(message));

				const cred = await getContent(message);
				console.log(JSON.parse(cred))
				setcredentials(JSON.parse(cred))
				console.log(message)
			} catch (error) {
				console.log(error)
			}
		})()
	}


	const login = async () => {
		if (!web3auth) {
			uiConsole('web3auth not initialized yet');
			return;
		}
		const web3authProvider = await web3auth.connect();

		const provider = new providers.Web3Provider(web3authProvider);
		const signer = provider.getSigner();
		setPasswordManagerContract(new Contract('0xfBB86493C252003E560291Db761e28ad1110Ac1E', PasswordManagerABI.abi, signer));
		setProvider(web3authProvider);
	};

	const authenticateUser = async () => {
		if (!web3auth) {
			uiConsole('web3auth not initialized yet');
			return;
		}
		const idToken = await web3auth.authenticateUser();
		uiConsole(idToken);
	};

	const getUserInfo = async () => {
		if (!web3auth) {
			uiConsole('web3auth not initialized yet');
			return;
		}
		const user = await web3auth.getUserInfo();
		uiConsole(user);
	};

	const logout = async () => {
		if (!web3auth) {
			uiConsole('web3auth not initialized yet');
			return;
		}
		await web3auth.logout();
		setProvider(null);
	};

	const getChainId = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const chainId = await rpc.getChainId();
		uiConsole(chainId);
	};
	const getAccounts = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const address = await rpc.getAccounts();

		return address;
		// uiConsole(address);
	};

	const getBalance = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const balance = await rpc.getBalance();
		uiConsole(balance);
	};

	const sendTransaction = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const receipt = await rpc.sendTransaction();
		uiConsole(receipt);
	};

	const signMessage = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const signedMessage = await rpc.signMessage();
		uiConsole(signedMessage);
	};

	const getPrivateKey = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const privateKey = await rpc.getPrivateKey();
		uiConsole(privateKey);
	};

	const encryptData = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const encryptedData = await rpc.encrypt(JSON.stringify({
			usernameOrEmail,
			password
		}));
		uiConsole(encryptedData);
	};

	const decryptData = async () => {
		if (!provider) {
			uiConsole('provider not initialized yet');
			return;
		}
		const rpc = new RPC(provider);
		const decryptedData = await rpc.decrypt(
			'0x7b226976223a7b2274797065223a22427566666572222c2264617461223a5b3134352c37382c39332c3132352c3230372c3130382c3139362c392c3232342c31382c3131392c3138312c3136362c3130362c38392c36355d7d2c22657068656d5075626c69634b6579223a7b2274797065223a22427566666572222c2264617461223a5b342c37302c3231392c3231362c3231372c3230352c3233362c3130332c3135382c35322c3233332c38372c3233332c322c38312c3137362c32332c3138302c3130372c35322c382c38302c3139362c3232392c36302c33372c38372c33382c3137342c38362c3230302c3231322c36352c3138322c39312c3234362c3233372c3136352c31352c3138392c3134382c35382c3234382c34342c37382c34372c3132392c3232352c33342c32372c38392c3235352c34382c3138352c39382c3231362c32372c35332c3230352c3230302c39392c3235302c32312c3132332c3138365d7d2c2263697068657274657874223a7b2274797065223a22427566666572222c2264617461223a5b3130342c34312c36392c3232362c31322c31302c3131362c3132392c3135322c3234382c3231322c39352c3232382c3137312c3231372c33342c31302c3131362c3130382c3132372c34382c3138392c3136302c3234322c3135382c38312c3233382c35312c37362c3132372c33372c3134322c34352c3233352c39392c36312c39312c3131362c3139342c38332c3230372c3133362c36372c33382c35332c3135332c35382c3233395d7d2c226d6163223a7b2274797065223a22427566666572222c2264617461223a5b32362c3135382c37342c3136382c39322c302c3139332c3137322c3134312c3135332c3234352c3234372c3133382c3139322c3130312c38332c32352c31332c3136372c3132302c3133342c3231312c3230332c3130392c3131342c3132362c3138302c35342c3131362c38382c35362c3130375d7d7d'
		);
		uiConsole(decryptedData);
	};

	function uiConsole(...args: any[]): void {
		const el = document.querySelector('#console>p');
		if (el) {
			el.innerHTML = JSON.stringify(args || {}, null, 2);
		}
	}

	const loggedInView = (
		<>

			<Tabs width={'full'} size='lg' isFitted variant='enclosed'>
				<TabList width={'full'} mb='1em'>
					<Tab>Save</Tab>
					<Tab>Retrieve</Tab>
				</TabList>
				<TabPanels width={'full'}>
					<TabPanel width={'full'}>
						<Flex direction="column" gap={'2'}>
							<Text>{currentUrl}</Text>
							<Input value={usernameOrEmail} type={'text'} onChange={(e) => setUsernameOrEmail(e.target.value)} placeholder='Email / Username' />
							<Input value={password} type={'password'} onChange={(e) => setPassword(e.target.value)} placeholder='Password' />
							<Button onClick={saveCredentails} marginLeft={'auto'} variant={'solid'}>Save</Button>
							{/* <Button onClick={decryptData} marginLeft={'auto'} variant={'solid'}>Decrypt</Button> */}
						</Flex>
						<div style={{ "display": "none" }} className='flex-container'>

							<div>
								<button onClick={getUserInfo} className='card'>
									Get User Info
								</button>
							</div>
							<div>
								<button onClick={authenticateUser} className='card'>
									Get ID Token
								</button>
							</div>
							<div>
								<button onClick={getChainId} className='card'>
									Get Chain ID
								</button>
							</div>
							<div>
								<button onClick={getAccounts} className='card'>
									Get Accounts
								</button>
							</div>
							<div>
								<button onClick={getBalance} className='card'>
									Get Balance
								</button>
							</div>
							<div>
								<button onClick={signMessage} className='card'>
									Sign Message
								</button>
							</div>
							<div>
								<button onClick={sendTransaction} className='card'>
									Send Transaction
								</button>
							</div>
							<div>
								<button onClick={getPrivateKey} className='card'>
									Get Private Key
								</button>
							</div>
							<div>
								<button onClick={logout} className='card'>
									Log Out
								</button>
							</div>
						</div>
					</TabPanel>
					<TabPanel width={'full'}>
						<Flex gap={4} direction="column">
							<Switch value={reveal} onChange={() => setReveal(Number(!reveal))} size='lg' />
							<Flex direction={'row'}>
								<Text>Username / Email: {reveal ? credentials?.usernameOrEmail : '********'}</Text>
								<Button size={'sm'} marginLeft={'auto'} onClick={onCopy}>{hasCopied ? "Copied!" : "Copy"}</Button>
							</Flex>
							<Flex direction={'row'}>
								<Text>Password: {reveal ? credentials?.password : '********'}</Text>
								<Button size={'sm'} marginLeft={'auto'} onClick={onCopy}>{hasCopied ? "Copied!" : "Copy"}</Button>

							</Flex>
						</Flex>
					</TabPanel>
				</TabPanels>
			</Tabs>
			<div>

			</div>
			<div id='console' style={{ whiteSpace: 'pre-line' }}>
				<p style={{ whiteSpace: 'pre-line' }}></p>
			</div>
		</>
	);

	const unloggedInView = (
		<>
			{!isFullPage ? (
				<button
					onClick={() => chrome.tabs.create({ url: 'index.html' })}
					className='card login'
				>
					Login
				</button>
			) : (
				<button onClick={login} className='card login'>
					Login
				</button>
			)}
		</>
	);

	return (
		<Box className='container'>
			{provider && <Flex mt={3} alignItems={'flex-end'} alignContent="flex-end" justifyContent={"end"}>
				<Button variant={'outline'} size="xs" onClick={logout} aria-label=''>Logout</Button>
			</Flex>}

			<Image marginTop={4} marginBottom={4} marginInline={'auto'} height={200} src={process.env.PUBLIC_URL + '/assets/main-image.png'}></Image>


			{/* <Text fontSize={'4xl'} color="blue.500" fontWeight={'extrabold'} marginTop={4} marginBottom={6} textAlign="center">De Keeper</Text> */}

			<div className='grid'>{provider ? loggedInView : unloggedInView}</div>

			{/* <footer className='footer'>
				<a
					href='https://github.com/Web3Auth/examples'
					target='_blank'
					rel='noopener noreferrer'
				>
					Source code
				</a>
			</footer> */}
		</Box>
	);
}

export default App;
