from selenium import webdriver    # webdriver for automation
from selenium.webdriver.chrome.options import Options

import time    # Allow The program to Wait for Load
import pickle    # Save Credentials Locally as an encrypted file
import os     # Open File
from sys import platform # checks what OS you are running

options = Options()
options.add_argument("user-data-dir=Chrome_Profile")
GameLimit = 20


def claim():
    print("")
    print("#"*90)
    print("""This script requires you to have Chrome/Chromium installed beside Chromedriver!
        """)
    print("""If you use a Linux based OS please install the ChromeDriver package
        On Ubuntu/Mint/Popos install it with  sudo apt install chromium-chromedriver
        On other Distros, use your package manager of choice!

        """)

    print("""Chromedriver should be available on homebrew or other 3rd pary pacmans on MacOS! (Unverified!)
        """)
    print("#"*90)
    print("")


    j = 0

    try:

        # Check If Credentials Is Saved

        if not os.path.exists("credentials.pkl"):
            # If file Doesnt Exists

            email = input("Enter Epic Games Email Address:\t")
            password = input("Enter Epic Games Password:\t")

            credentials = email + "-" + password + "-" + str(GameLimit)
            pickle.dump(credentials, open("credentials.pkl", "wb"))  # Save Credentials as an encrypted File
            print("To Enter for New Account Run DeleteCredentials.py ")

        else:
            # If Credentials Are Found

            Token = pickle.load(open("credentials.pkl", "rb"))
            credentials = Token.split("-")
            email = credentials[0]
            password = credentials[1]
            print("Found! To Enter for New Account Run DeleteCredentials.py ")

        print("driver Start")
        # Open webdriver
        try:


            if platform == "linux" or platform == "linux2":
                print("Platform = Linux")
                driver = webdriver.Chrome(r"chromedriver", options=options)
            elif platform == "darwin":
                print("Platform = Macos/OSX")
                print("MacOS is not supported as of now and the following code is not tested on MacOS!")
                driver = webdriver.Chrome(r"chromedriver", options=options)
            elif platform == "win32":
                print("Platform = Windows")
                driver = webdriver.Chrome(r"chromedriver.exe", options=options)
            else:
                print("Your OS is unsupported!")

            driver.get("https://www.epicgames.com/store/en-US/free-games")
            print("starting Chrome(ium)")

        except Exception as e:
            print("Something went wrong with ChromeDriver:")
            print(e)
        time.sleep(15)
        print("End")

        # Find All Free Games
        Games = driver.find_elements_by_xpath("//body/div/div/div/main/div/div/div/div/div/div/div/div[1]/section[1]/div[1]/div")
        MoreG = driver.find_elements_by_xpath("//body/div/div/div/main/div/div/div/div/div/div/div/div[2]/section[1]/div[1]/div")
        numOfGames = len(Games) + len(MoreG)

        # Iterate Through For Every Free Game Found
        print(str(numOfGames) , "free games found!" )
        for i in range(numOfGames):
            try:
                time.sleep(5)

                Games = driver.find_elements_by_xpath("//body/div/div/div/main/div/div/div/div/div/div/div/div[1]/section[1]/div[1]/div")
                MoreG = driver.find_elements_by_xpath("//body/div/div/div/main/div/div/div/div/div/div/div/div/section/div/div")

                try:
                    if i >= numOfGames:  # Check If Users wished Game Count is completed
                        driver.close()
                        driver.quit()
                        print("Task Completed")
                        quit()

                except:
                    pass

                if i >= len(Games) - 1:
                    MoreG[j].click()
                    j += 1
                else:
                    Games[i].click()  # Click The Game To Open The Game Page
                time.sleep(20)

                try:
                    driver.find_element_by_xpath("//body/div/div/div/main/div/div/div/div/button[1]").click()
                    print("Game is 18+")
                    time.sleep(10)

                except:
                    pass

                try:
                    time.sleep(5)
                    # Search for Buy Button
                    try:
                        driver.find_element_by_xpath("//html//body//div//div//div//main//div//div//div//div//div//div//div//div//div//div//div//div//div//div//button//span//span[contains(text(),'Get')]").click()

                    except:
                        pass

                    if i == 0:

                        try:
                            # Login if First Game

                            time.sleep(5)
                            driver.find_element_by_xpath("//h6[contains(text(),'Sign in with Epic Games')]").click()
                            time.sleep(5)
                            driver.find_element_by_xpath("//input[@id='email']").send_keys(email)  # Enter Email
                            driver.find_element_by_xpath("//input[@id='password']").send_keys(password)  # Enter Password
                            time.sleep(30)
                            driver.find_element_by_xpath(
                                "//span[@class='MuiButton-label']").click()  # Wait Time Before Logging In to Avoid Captcha
                        except:
                            pass

                    try:
                        # Try And Purchase The Game

                        time.sleep(30)
                        driver.find_element_by_xpath("//button[@class='btn btn-primary']").click()  # Click Confirm to Buy

                        time.sleep(10)
                        driver.get("https://www.epicgames.com/store/en-US/free-games")  # Return To Games Page

                    except:
                        driver.get("https://www.epicgames.com/store/en-US/free-games")
                        # Return to Games Page as Game was Already Bought
                        print("Game Was Pre-Bought")

                except:
                    driver.get(
                        "https://www.epicgames.com/store/en-US/free-games")  # Return to Games Page as Buy Button was Not Found

            except:
                pass

            time.sleep(10)
            Games = driver.find_elements_by_class_name("css-qk4tu0")  # Re-Search for all Free Games

        # Close The Webdriver as Task was Successfully completed
        driver.close()
        driver.quit()
        print("Task Completed Successfully")
        return True

    except:
        try:
            driver.quit()
        except:
            pass
        return False


while not claim():
    time.sleep(30)
