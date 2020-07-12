from selenium import webdriver    # webdriver for automation

import time    # Allow The program to Wait for Load
import pickle    # Save Credentials Locally as an encrypted file
import os     # Open File

driver = webdriver    # declare Variable

try:

    # Check If Credentials Is Saved

    if not os.path.exists("credentials.pkl"):
        # If file Doesnt Exists

        email = input("Enter Epic Games Email Address:\t")
        password = input("Enter Epic Games Password:\t")
        GameLimit = int(input("Enter How many Games To cycle Through (Note: First Run will Go through all Games) (Recommended is 5):\t"))
        credentials = email + "-" + password + "-" + str(GameLimit)
        GameLimit = 20    # Cycle through all games in First Run
        pickle.dump(credentials, open("credentials.pkl", "wb"))    # Save Credentials as an encrypted File
        print("To Enter for New Account Run DeleteCredentials.py ")

    else:
        # If Credentials Are Found

        Token = pickle.load(open("credentials.pkl", "rb"))
        credentials = Token.split("-")
        email = credentials[0]
        password = credentials[1]
        GameLimit = int(credentials[2])
        print("To Enter for New Account Run DeleteCredentials.py ")

    # Open webdriver
    driver = webdriver.Chrome(r"chromedriver.exe")
    driver.minimize_window()
    driver.get("https://www.epicgames.com/store/en-US/free-games")
    time.sleep(10)

    # Find All Free Games
    Games = driver.find_elements_by_class_name("css-qk4tu0")
    numOfGames = len(Games)

    # Iterate Through For Every Free Game Found
    for i in range(numOfGames):

        if i >= GameLimit + 1:    # Check If Users wished Game Count is completed
            driver.close()
            driver.quit()
            print("Task Completed")
            quit()

        Games[i].click()    # Click The Game To Open The Game Page
        time.sleep(10)

        try:
            driver.find_element_by_xpath("//button[@class='Button-main_d4ab9eb9 Button-primary_093f075b Button-hasHover_8f3ca91c Button-hasMinWidth_b666ef1e Button-dark_c0429b3d']").click()
            print("Game is 18+")
            time.sleep(5)

        except:
            pass

        try:
            time.sleep(5)
            # Search for Buy Button
            driver.find_element_by_xpath("//html//body//div//div//div//main//div//div//div//div//div//div//div//div//div//div//div//div//div//div//button//span//span[contains(text(),'Get')]//..//..").click()

            if i == 0:
                # Login if First Game

                time.sleep(5)
                driver.find_element_by_xpath("//h6[contains(text(),'Sign in with Epic Games')]").click()
                driver.find_element_by_xpath("//input[@id='email']").send_keys(email)    # Enter Email
                driver.find_element_by_xpath("//input[@id='password']").send_keys(password)    # Enter Password
                time.sleep(25)
                driver.find_element_by_xpath("//span[@class='MuiButton-label']").click()    # Wait Time Before Logging In to Avoid Captcha

            try:
                # Try And Purchase The Game

                time.sleep(25)
                driver.find_element_by_xpath("//button[@class='btn btn-primary']").click()

                time.sleep(5)
                driver.get("https://www.epicgames.com/store/en-US/free-games")    # Return To Games Page

            except:
                driver.get("https://www.epicgames.com/store/en-US/free-games")
                # Return to Games Page as Game was Already Bought
                print("Game Was Pre-Bought")

        except:
            driver.get("https://www.epicgames.com/store/en-US/free-games")    # Return to Games Page as Buy Button was Not Found

        time.sleep(10)
        Games = driver.find_elements_by_class_name("css-qk4tu0")    # Re-Search for all Free Games

    # Close The Webdriver as Task was Successfully completed
    driver.close()
    driver.quit()
    print("Task Completed Successfully")

except:
    try:
        driver.quit()
    except:
        pass
