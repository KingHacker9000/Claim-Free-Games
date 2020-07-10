from selenium import webdriver

import time
import pickle
import os


if not os.path.exists("credentials.pkl"):
    email = input("Enter Epic Games Email Address:\t")
    password = input("Enter Epic Games Password:\t")
    credentials = email + "-" + password
    pickle.dump(credentials, open("credentials.pkl", "wb"))

else:
    Token = pickle.load(open("credentials.pkl", "rb"))
    credentials = Token.split("-")
    email = credentials[0]
    password = credentials[1]


driver = webdriver.Chrome(r"chromedriver.exe")
driver.minimize_window()

driver.get("https://www.epicgames.com/store/en-US/free-games")

time.sleep(10)

Games = driver.find_elements_by_class_name("css-qk4tu0")

numOfGames = len(Games)

for i in range(numOfGames):

    if i >= 5:
        driver.close()
        quit()

    Games[i].click()

    time.sleep(10)

    try:
        driver.find_element_by_xpath("//button[@class='Button-main_d4ab9eb9 Button-primary_093f075b Button-hasHover_8f3ca91c Button-hasMinWidth_b666ef1e Button-dark_c0429b3d']").click()
        print("18+")
        time.sleep(2)


    except:
        pass


    try:
        driver.find_element_by_xpath("//div[@class='PurchaseButton-wrapper_08b35b7d PurchaseButton-main_3ea443e2']//button[@class='Button-main_d4ab9eb9 Button-primary_093f075b Button-hasHover_8f3ca91c PurchaseButton-button_d3bea90e']").click()

        if i == 0:
            time.sleep(5)
            driver.find_element_by_xpath("//h6[contains(text(),'Sign in with Epic Games')]").click()
            driver.find_element_by_xpath("//input[@id='email']").send_keys(email)
            driver.find_element_by_xpath("//input[@id='password']").send_keys(password)

            time.sleep(25)

        try:
            driver.find_element_by_xpath("//span[@class='MuiButton-label']").click()

            time.sleep(25)
            driver.find_element_by_xpath("//button[@class='btn btn-primary']").click()

            time.sleep(5)
            driver.get("https://www.epicgames.com/store/en-US/free-games")


        except:
            driver.get("https://www.epicgames.com/store/en-US/free-games")
            print("Pre-Bought")


    except:
        driver.get("https://www.epicgames.com/store/en-US/free-games")
        print("Pre-Bought")
        

    time.sleep(10)
    Games = driver.find_elements_by_class_name("css-qk4tu0")

driver.close()
